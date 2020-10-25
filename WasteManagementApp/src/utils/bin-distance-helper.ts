/**
 * Author name: Yisong Yu
 * Last modified date: October 24, 2020
 * Description: 
 * This source code file includes all the bin distance-related helper functions grouped in the class named 
 * BinDistanceHelper that is not intended to be instantiated. It provides the functionality of computing and 
 * updating all bin distances, or only those bin distances that are necessary to be updated according to the 
 * input information regarding the deleted, created and updated bins, and converting the input distance matrix to
 * an array of bin distance documents as a utility to facilitate the process of insertion of bin distance documents.
 */

import mongoose from "mongoose";
import { UPDATE_ALL_BIN_DISTANCES_LOG_TAG, UPDATE_BIN_DISTANCES_LOG_TAG } from "../constants/log-tag";
import BinDistance from "../models/bin-distance";
import Depot from "../models/depot";
import DumbBin from "../models/dumb-bin";
import SmartBin from "../models/smart-bin";
import { DeletedBinInfo, CreatedBinInfo, UpdatedBinInfo, BinDistanceInfo, DepotInfo, IdLatLng, DistanceMatrixElement, mongooseInsertWriteOpResult } from "./type-information";
import { GoogleMapsServicesAdapter } from "./google-maps-services-adapter";
import { Logger } from "./logger";

export class BinDistanceHelper {
    /**
     * Prevent others from instantiating this class
     */
    private constructor() {}

    /**
     * Compute and update the distances between all pairs of smart bins, dumb bins, and depots in the database
     * 
     * @async
     * @param {GoogleMapsServicesAdapter} googleMapsServicesAdapter a GoogleMapsServicesAdapter instance
     * 
     * @returns {boolean} true if the update succeeds without errors, false otherwise
     */
    public static async updateAllBinDistances(googleMapsServicesAdapter: GoogleMapsServicesAdapter): Promise<boolean> {
        try {
            // projectPipelineStage stores the object that specifies the project stage of the aggregation pipeline
            const projectPipelineStage = {
                $project: {
                    longitude: {
                        $arrayElemAt: ["$location.coordinates", 0]
                    },
                    latitude: {
                        $arrayElemAt: ["$location.coordinates", 1]
                    }
                }
            };
            // depots stores an array of IdLatLng objects each containing _id, latitude, and longitude properties of a depot 
            // currently stored in the database, and due to the limitation of this application, only one depot is allowed 
            // to be used for routing scheduling
            const depots: IdLatLng[] = await Depot.aggregate([
                // Limited to only one depot in this project as the routing solver is unable to support multiple depots
                {
                    $limit: 1
                },
                projectPipelineStage
            ]);
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "depots", depots, "\n");

            // smartBins stores an array of IdLatLng objects each containing _id, latitude, and longitude properties of a 
            // smart bin currently stored in the database
            const smartBins: IdLatLng[] = await SmartBin.aggregate([projectPipelineStage]);
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "smartBins", smartBins, "\n");

            // dumbBins stores an array of IdLatLng objects each containing _id, latitude, and longitude properties of a 
            // dumb bin currently stored in the database
            const dumbBins: IdLatLng[] = await DumbBin.aggregate([projectPipelineStage]);
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "dumbBins", dumbBins, "\n");
            
            // As we need to compute the distances between all pairs of depots, smart bins, and dumb bins, 
            // origins and destinations both store all depots, smart bins, dumb bins currently stored in the database, 
            // where each of them is identified as an IdLatLng object containing _id, latitude, and longitude properties
            const origins = depots.concat(smartBins).concat(dumbBins);
            const destinations = origins;
            // originTypes and destinationTypes store the corresponding type of each IdLatLng object (i.e., whether it  
            // represents a depot, or a smart bin, or a dumb bin) in origins and destinations array respectively
            const originTypes = 
                ["Depot"].concat(new Array(smartBins.length).fill("SmartBin")).concat(new Array(dumbBins.length).fill("DumbBin"));
            const destinationTypes = originTypes;

            // Compute the distance matrix given the origins and destinations specified above and convert the resulting matrix
            // to an array of bin distance documents each containing origin, originType, destination, destinationType, distance, 
            // duration properties, which can be directly inserted to the corresponding BinDistances database collection
            const allBinDistancesInfo = BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                await googleMapsServicesAdapter.computeDistanceMatrix(origins, destinations),
                origins,
                originTypes,
                destinations,
                destinationTypes
            );
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "allBinDistancesInfo", allBinDistancesInfo, "\n");
            
            // Delete all the old bin distance documents
            const oldBinDistancesDeleteResult = await BinDistance.deleteMany({});
            // Only continue if the delete operation of all old bin distance documents succeeds above
            if (oldBinDistancesDeleteResult.ok !== 1) {
                Logger.verboseError(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
                throw new Error("Failed to delete old bin distances");
            }
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
            
            // Insert all the newly computed bin distance documents
            const newBinDistancesInsertResult = await BinDistance.insertMany(allBinDistancesInfo, {
                rawResult: true
            }) as unknown as mongooseInsertWriteOpResult;
            // Only continue if the insert operation of all the new bin distance documents succeeds above
            if (newBinDistancesInsertResult.result?.ok !== 1) {
                Logger.verboseError(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
                throw new Error("Failed to insert new bin distances");
            }
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "newBinDistancesInsertResult", newBinDistancesInsertResult, "\n");
            
            return true;
        } catch (error) {
            Logger.error(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, error, "\n");
            return false;
        }
    }

    /**
     * Compute and update the distances between only a selection of pairs of smart bins, dumb bins, and depots 
     * in the database according to the input information regarding the deleted, created and updated bins in 
     * order to reduce the time required for the overall computation by limiting the recomputation of the bin 
     * distances to a minimum without doing any unnecessary work for those bins that remain the same in the 
     * database, compared to updateAllBinDistances function which is inferior in terms of the execution speed, 
     * as that one will include all depots, smart bins and dumb bins as origins and destinations to be sent as 
     * the payload of the request to the Google Distance Matrix API. Therefore using this fucntion appropriately 
     * will be more efficient and more cost-effective.
     * 
     * @async
     * @param {GoogleMapsServicesAdapter} googleMapsServicesAdapter a GoogleMapsServicesAdapter instance
     * @param {deletedBinsInfo[]} deletedBinsInfo an array of strings where each represents an ID of a bin that has been deleted
     * @param {CreatedBinInfo[]} createdBinsInfo an array of objects each containing the _id, longitude, and latitude properties
     *                                           of a bin that has been created
     * @param {UpdatedBinInfo[]} updatedBinsInfo an array of objects each containing the _id, longitude, and latitude properties
     *                                           of a bin that has been updated
     * @param {boolean} isSmart whether the input bin information is for a smart bin or not
     * 
     * @returns {boolean} true if the update succeeds without errors, false otherwise
     */
    public static async updateBinDistances(
        googleMapsServicesAdapter: GoogleMapsServicesAdapter,
        deletedBinsInfo: DeletedBinInfo[], 
        createdBinsInfo: CreatedBinInfo[], 
        updatedBinsInfo: UpdatedBinInfo[],
        isSmart: boolean
    ): Promise<boolean> {
        try {
            // binsIdsDeleted stores all the IDs of deleted and updated bins
            const binsIdsDeleted = deletedBinsInfo.concat(updatedBinsInfo.map((updatedBinInfo) => updatedBinInfo._id));
            // Delete each bin distance document whose origin or destination matches one of the IDs in binIdsDeleted, as 
            // the bin it references to (as a foreign key) no longer exists or its location has already changed, and hence 
            // such a bin distance document is no longer valid
            // Only send the request to delete if there's indeed something to delete, otherwise, avoid sending one extra request
            // to the database to reduce the network request (if it is a remote databse) to improve the performance slightly
            const oldBinDistancesDeleteResult = binsIdsDeleted.length > 0 ? 
                await BinDistance.deleteMany({
                    $or: [
                        {
                            $and: [
                                {
                                    originType: isSmart ? "SmartBin" : "DumbBin"
                                },
                                {
                                    origin: {
                                        $in: binsIdsDeleted.map(_id => new mongoose.Types.ObjectId(_id))
                                    }
                                }
                            ]
                        },
                        {
                            $and: [
                                {
                                    destinationType: isSmart ? "SmartBin" : "DumbBin"
                                },
                                {
                                    destination: {
                                        $in: binsIdsDeleted.map(_id => new mongoose.Types.ObjectId(_id))
                                    }
                                }
                            ]
                        }
                    ]
                }) : {
                    ok: 1,
                    n: 0,
                    deletedCount: 0
                };

            // Only continue if the delete operation of the relavent old bin distance documents succeeds above
            if (oldBinDistancesDeleteResult.ok !== 1) {
                Logger.verboseError(UPDATE_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
                throw new Error("Failed to delete old bin distances");
            }
            Logger.verboseLog(UPDATE_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
            
            // binsCreated stores all the input information (i.e., ID, latitude, longitude) of created and updated bins
            const binsCreated = createdBinsInfo.concat(updatedBinsInfo);

            // Only compute the new bin distances and send the request to insert if there's something to update
            if (binsCreated.length > 0) {
                const BinModelSameType = isSmart ? SmartBin : DumbBin;
                const BinModelDifferentType = isSmart ? DumbBin : SmartBin;
                
                // Retrieve all the other existing bins of the same type as the input bins that are not the created 
                // or updated bins specified in the input arguments
                const binsCreatedComplement: CreatedBinInfo[] = await BinModelSameType.aggregate([
                    {
                        $match: {
                            _id: {
                                $nin: binsCreated.map(bin => new mongoose.Types.ObjectId(bin._id))
                            }
                        }
                    },
                    {
                        $project: {
                            _id: true,
                            longitude: {
                                $arrayElemAt: ["$location.coordinates", 0]
                            },
                            latitude: {
                                $arrayElemAt: ["$location.coordinates", 1]
                            }
                        }
                    }
                ]);
                Logger.verboseLog(UPDATE_BIN_DISTANCES_LOG_TAG, "binsCreatedComplement", binsCreatedComplement, "\n");

                // Retrieve all the bins of the different type from the input bins
                const binsDifferentType: CreatedBinInfo[] = await BinModelDifferentType.aggregate([
                    {
                        $project: {
                            _id: true,
                            longitude: {
                                $arrayElemAt: ["$location.coordinates", 0]
                            },
                            latitude: {
                                $arrayElemAt: ["$location.coordinates", 1]
                            }
                        }
                    }
                ]);
                Logger.verboseLog(UPDATE_BIN_DISTANCES_LOG_TAG, "binsDifferentType", binsDifferentType, "\n");

                // Retrieve all the depots
                // NOTE: In this application, only one depot is allowed and ever exists in the Depot database collection
                const depots: DepotInfo[] = await Depot.aggregate([
                    {
                        $project: {
                            _id: true,
                            longitude: {
                                $arrayElemAt: ["$location.coordinates", 0]
                            },
                            latitude: {
                                $arrayElemAt: ["$location.coordinates", 1]
                            }
                        }
                    }
                ]);
                Logger.verboseLog(UPDATE_BIN_DISTANCES_LOG_TAG, "depots", depots, "\n");

                // Compute the distance matrix for each of all possible combinations of binsCreated, binsCreatedComplement, binsDifferentType, 
                // and depots as origins and destinations, and convert each resulting matrix to an array of bin distance documents, 
                // and eventually flatten the resulting array of arrays of bin distance documents to an array of bin distance 
                // documents, which can be directly inserted to the corresponding BinDistances database collection right after
                const binDistancesInfo = [
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServicesAdapter.computeDistanceMatrix(binsCreated, binsCreated), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ),
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServicesAdapter.computeDistanceMatrix(binsCreated, binsCreatedComplement), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsCreatedComplement, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServicesAdapter.computeDistanceMatrix(binsCreatedComplement, binsCreated), 
                        binsCreatedComplement, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServicesAdapter.computeDistanceMatrix(binsCreated, binsDifferentType), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsDifferentType, 
                        isSmart ? "DumbBin" : "SmartBin"
                    ),
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServicesAdapter.computeDistanceMatrix(binsDifferentType, binsCreated), 
                        binsDifferentType, 
                        isSmart ? "DumbBin" : "SmartBin", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServicesAdapter.computeDistanceMatrix(binsCreated, depots), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        depots, 
                        "Depot"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServicesAdapter.computeDistanceMatrix(depots, binsCreated), 
                        depots, 
                        "Depot", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                ].flatMap(binDistanceInfo => binDistanceInfo);
                Logger.verboseLog(UPDATE_BIN_DISTANCES_LOG_TAG, "binDistancesInfo", binDistancesInfo, "\n");

                // Insert all the newly computed bin distance documents
                const newBinDistancesInsertResult = await BinDistance.insertMany(binDistancesInfo, {
                    rawResult: true
                }) as unknown as mongooseInsertWriteOpResult;
                // Only continue if the insert operation of all the new bin distance documents succeeds above
                if (newBinDistancesInsertResult.result?.ok !== 1) {
                    Logger.verboseError(UPDATE_BIN_DISTANCES_LOG_TAG, "newBinDistancesInsertResult", newBinDistancesInsertResult, "\n");
                    throw new Error("Failed to insert new bin distances");
                }
                Logger.verboseLog(UPDATE_BIN_DISTANCES_LOG_TAG, "newBinDistancesInsertResult", newBinDistancesInsertResult, "\n");
            }

            return true;
        } catch (error) {
            Logger.error(UPDATE_BIN_DISTANCES_LOG_TAG, error, "\n");
            return false;
        }
    }
    
    /**
     * Convert the input distance matrix to an array of bin distance documents 
     * 
     * @param {DistanceMatrixElement[][]} distanceMatrix a distance matrix where each cell at row i and column j has an object 
     *                                                   containing both distance and duration properties, which corresponds to 
     *                                                   distance and duration to travel from the place specified in origin[i] 
     *                                                   to the place specified in destinations[j]
     * @param {IdLatLng[]} origins an array of IdLatLng objects containing _id, latitude, and longitude properties to be used as the origins
     * @param {string | string[]} originTypes a string specifying the type of all origins if all origins are of the same type, otherwise an
     *                                        array of strings specifying the type of each origin in origins
     * @param {IdLatLng[]} destinations an array of IdLatLng objects containing _id, latitude, and longitude properties to be used as the destinations
     * @param {string | string[]} destinationTypes a string specifying the type of all destinations if all destinations are of the same type, 
     *                                             otherwise an array of strings specifying the type of each destination in destinations
     * 
     * @returns {BinDistanceInfo[]} an array of bin distance documents each containing origin, originType, destination, destinationType, 
     *                              distance, duration properties, which can be directly inserted to the corresponding BinDistances 
     *                              database collection
     */
    public static convertFromDistanceMatrixToBinDistanceDocuments(
        distanceMatrix: DistanceMatrixElement[][], 
        origins: IdLatLng[],
        originTypes: string | string[],
        destinations: IdLatLng[],
        destinationTypes: string | string[]
    ): BinDistanceInfo[] {
        return (
            distanceMatrix.flatMap((row, originIndex) => 
                row.map((col, destinationIndex) => ({
                    origin: origins[originIndex]._id,
                    originType: Array.isArray(originTypes) ? originTypes[originIndex] : originTypes,
                    destination: destinations[destinationIndex]._id,
                    destinationType: Array.isArray(destinationTypes) ? destinationTypes[destinationIndex]: destinationTypes,
                    distance: col.distance,
                    duration: col.duration
                }))
            )
        );
    }
}
