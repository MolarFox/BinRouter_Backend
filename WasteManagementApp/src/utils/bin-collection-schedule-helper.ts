/**
 * Author name: Yisong Yu
 * Last modified date: October 24, 2020
 * Description: 
 * This source code file includes all the bin collection schedule-related helper functions grouped in the class named 
 * BinCollectionScheduleHelper that is not intended to be instantiated. It provides the functionality of computing 
 * and updating the bin collection schedules based on the current state of smart bins, dumb bins, and fleet vehicles.
 */
import mongoose from "mongoose";
import { UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG } from "../constants/log-tag";
import { FULLNESS_THRESHOLD_RATIO_SELECTION_CRITERION } from "../constants/misc";
import BinCollectionSchedule from "../models/bin-collection-schedule";
import BinDistance from "../models/bin-distance";
import Depot from "../models/depot";
import DumbBin from "../models/dumb-bin";
import FleetVehicle from "../models/fleet-vehicle";
import SmartBin from "../models/smart-bin";
import { Logger } from "./logger";
import { RoutingSolverAdapter } from "./routing-solver-adapter";
import { BinDistanceInfo, DepotCollectInfo, DumbBinCollectInfo, FleetVehicleCollectInfo, mongooseInsertWriteOpResult, SmartBinCollectInfo } from "./type-information";

export class BinCollectionScheduleHelper {
    /**
     * Prevent others from instantiating this class
     */
    private constructor() {}

    /**
     * Compute and update the bin collection schedules
     * 
     * @async
     * 
     * @returns {boolean} true if the update succeeds without errors, false otherwise
     */
    public static async updateBinCollectionSchedules(): Promise<boolean> {
        try {
            // depot stores only one depot currently stored in the databse as the routing solver is unable to 
            // support multiple depots to be specified as the input
            // NOTE: the volume of the waste to be collected at the depot still needs to be specified as depot 
            // will be used as the start and the end node when computing the routes
            const [depot]: DepotCollectInfo[] = await Depot.aggregate([
                {
                    $limit: 1
                },
                {
                    $project: {
                        longitude: {
                            $arrayElemAt: ["$location.coordinates", 0]
                        },
                        latitude: {
                            $arrayElemAt: ["$location.coordinates", 1]
                        },
                        volume: {
                            $literal: 0
                        }
                    }
                }
            ]);
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "depot", depot, "\n");

            // smartBins stores all smart bins whose current fullness is greater than the predefined selection criterion, and
            // the volume of the waste to be collected is estimated by multiplying the capacity by the fullness percentage 
            const smartBins: SmartBinCollectInfo[] = await SmartBin.aggregate([
                {
                    $project: {
                        longitude: {
                            $arrayElemAt: ["$location.coordinates", 0]
                        },
                        latitude: {
                            $arrayElemAt: ["$location.coordinates", 1]
                        },
                        capacity: true,
                        fullnessPercentage: {
                            $divide: ["$currentFullness", "$threshold"]
                        }
                    }
                },
                { 
                    $match: {
                        fullnessPercentage: {
                            $gte: FULLNESS_THRESHOLD_RATIO_SELECTION_CRITERION
                        }
                    }
                },
                {
                    $project: {
                        longitude: true,
                        latitude: true,
                        volume: {
                            $multiply: ["$capacity", "$fullnessPercentage"]
                        }
                    }
                }
            ]);
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "smartBins", smartBins, "\n");

            // dumbBins stores the dumb bins whose nearestSmartBin field is referencing a smart bin in smartBins (i.e., those 
            // which have been selected to be collected as shown above), or is currently null indicating that no nearest smart 
            // bin can be found within the predefined search range, and will always be collected when computing the bin 
            // collection schedule, and such a dumb bin's volume of waste to be collected is estimated by multiplying its 
            // capacity by its nearest smart bin's current fullness percentage if there exists one, or simly using its capacity 
            // if there's no nearest smart bin around it, which assumes that it is always full when it needs to be collected
            const dumbBins: DumbBinCollectInfo[] = await DumbBin.aggregate([
                {
                    $match: {
                        $or: [
                            {
                                nearestSmartBin: {
                                    $in: smartBins.map(smartBin => smartBin._id)
                                }
                            },
                            {
                                nearestSmartBin: null
                            }
                        ]
                    }
                },
                {
                    $lookup: {
                        from: "SmartBins",
                        localField: "nearestSmartBin",
                        foreignField: "_id",
                        as: "nearestSmartBin"
                    }
                },
                {
                    $unwind: {
                        path: "$nearestSmartBin",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        longitude: {
                            $arrayElemAt: ["$location.coordinates", 0]
                        },
                        latitude: {
                            $arrayElemAt: ["$location.coordinates", 1]
                        },
                        volume: {
                            $ifNull: [
                                {
                                    $multiply: [
                                        {
                                            $divide: ["$nearestSmartBin.currentFullness", "$nearestSmartBin.threshold"]
                                        },
                                        "$capacity"
                                    ]
                                },
                                "$capacity"
                            ]
                        }
                    }
                }
            ]);
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "dumbBins", dumbBins, "\n");

            // fleetVehicles stores all the fleet vehicles that are currently available to be used and 
            // belong to the depot retrieved above
            const fleetVehicles: FleetVehicleCollectInfo[] = await FleetVehicle.aggregate([
                {
                    $match: {
                        available: true,
                        homeDepot: depot._id
                    }
                },
                {
                    $project: {
                        capacity: true,
                    }
                }
            ]);
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "fleetVehicles", fleetVehicles, "\n");

            // binDistances stores the distances between all possible pairs of depot, smartBins, dumbBins 
            // selected above for collection
            const binDistances: BinDistanceInfo[] = await BinDistance.aggregate([
                {
                    $match : {
                        $and: [
                            {
                                $or: [
                                    {
                                        $and: [
                                            {
                                                origin: {
                                                    $in: smartBins.map(smartBin => smartBin._id)
                                                }
                                            },
                                            {
                                                originType: "SmartBin"
                                            }
                                        ]
                                    },
                                    {
                                        $and: [
                                            {
                                                origin: {
                                                    $in: dumbBins.map(dumbBin => dumbBin._id)
                                                }
                                            },
                                            {
                                                originType: "DumbBin"
                                            }
                                        ]
                                    },
                                    {
                                        origin: depot._id,
                                        originType: "Depot"
                                    }
                                ]
                            },
                            {
                                $or: [
                                    {
                                        $and: [
                                            {
                                                destination: {
                                                    $in: smartBins.map(smartBin => smartBin._id)
                                                }
                                            },
                                            {
                                                destinationType: "SmartBin"
                                            }
                                        ]
                                    },
                                    {
                                        $and: [
                                            {
                                                destination: {
                                                    $in: dumbBins.map(dumbBin => dumbBin._id)
                                                }
                                            },
                                            {
                                                destinationType: "DumbBin"
                                            }
                                        ]
                                    },
                                    {
                                        destination: depot._id,
                                        destinationType: "Depot"
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    $project: {
                        _id: false,
                        __v: false
                    }
                }
            ]);
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "binDistances", binDistances, "\n");

            // binDistanceMatrix is used to store the distance matrix constructed from binDistances above, and  
            // the indices of both origins and destinations are in the order of depot, and then all selected 
            // smart bins followed by all selected dumb bins
            const binDistanceMatrix: number[][] = Array.from(
                new Array(1 + smartBins.length + dumbBins.length), 
                () => new Array(1 + smartBins.length + dumbBins.length).fill(-1)
            );
            // dictFromMatrixIndexToDocument and dictFromDocumentTypeAndIdToMatrixIndex simulate a bidirectional map 
            // between the matrix index and the document (i.e., depot, smart bin, dumb bin)
            const dictFromMatrixIndexToDocument: {
                [index: number]: any
            } = {
                0: Object.assign(depot, {
                    type: "Depot"
                })
            };
            const dictFromDocumentTypeAndIdToMatrixIndex: {
                [type: string]: {
                    [_id: string]: number
                }
            } = {
                Depot: {
                    [depot._id]: 0
                },
                SmartBin: {},
                DumbBin: {}
            };

            smartBins.forEach((smartBin, index) => {
                // mappedIndex stores the actual corresponding distance matrix index for the current smart bin (i.e., smartBins[index]), 
                // as it comes right after the depot, which is that offset of 1 to be added at the front
                const mappedIndex = 1 + index;
                // Store this smart bin document in the forward map with the key being the mapped index
                dictFromMatrixIndexToDocument[mappedIndex] = Object.assign(smartBin, {
                    type: "SmartBin"
                });
                // Store this mapped index in the backward map with the key being the id of this smart bin document
                dictFromDocumentTypeAndIdToMatrixIndex.SmartBin[smartBin._id] = mappedIndex;
            });
            dumbBins.forEach((dumbBin, index) => {
                // mappedIndex stores the actual corresponding distance matrix index for the current dumb bin (i.e., dumbBins[index]), 
                // as it comes right after the sequence of smart bins which in turn comes right after the depot, which is that offset 
                // of 1 + smartBins.length to be added at the front
                const mappedIndex = 1 + smartBins.length + index;
                // Store this dumb bin document in the forward map with the key being the mapped index
                dictFromMatrixIndexToDocument[mappedIndex] = Object.assign(dumbBin, {
                    type: "DumbBin"
                });
                // Store this mapped index in the backward map with the key being the id of this dumb bin document
                dictFromDocumentTypeAndIdToMatrixIndex.DumbBin[dumbBin._id] = mappedIndex;
            });

            // Construct the distance matrix based on the bidirectional map (only the backward map though) built above
            binDistances.forEach((binDistance) => {
                const row = dictFromDocumentTypeAndIdToMatrixIndex[binDistance.originType][binDistance.origin];
                const col = dictFromDocumentTypeAndIdToMatrixIndex[binDistance.destinationType][binDistance.destination];
                binDistanceMatrix[row][col] = binDistance.distance;
            });
            // binWeights stores the volume of each of the depots (only 1 though), the selected smart bins, and the selected 
            // dumb bins in the order as specified before
            const binWeights = [depot.volume].concat(smartBins.map(smartBin => smartBin.volume)).concat(dumbBins.map(dumbBin => dumbBin.volume)).map(Math.round);
            // vehicleCapacities stores the capacity of each available vehicles that belong to the retrieved depot
            const vehicleCapacities = fleetVehicles.map(fleetVehicle => Math.round(fleetVehicle.capacity));

            // Execute the routing solver with all available routing strategies
            const uniqueSetOfRoutesUsingIndex = await RoutingSolverAdapter.executeAllStrategies(binDistanceMatrix, binWeights, vehicleCapacities);
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "uniqueSetOfRoutesUsingIndex", uniqueSetOfRoutesUsingIndex, "\n");

            /**
             * Legacy code that is commented out below, which was previously used to compute the actual directions 
             * of the computed routes above (i.e., visiting order of all bins including the depot), which is now 
             * delegated to the frontend client to do
             */

            // const uniqueSetOfRoutesUsingCoordinates = uniqueSetOfRoutesUsingIndex.map((routesUsingIndex) => 
            //     routesUsingIndex.map((routeUsingIndex) => 
            //         routeUsingIndex.length < 2 ? [] : routeUsingIndex.map((nodeInIndex) => ({
            //             longitude: dictFromMatrixIndexToDocument[nodeInIndex].longitude as number,
            //             latitude: dictFromMatrixIndexToDocument[nodeInIndex].latitude as number
            //         }))
            //     )
            // );

            // const setOfBinCollectionSchedules = 
            //     await Promise.all(
            //         uniqueSetOfRoutesUsingCoordinates.map(async (routesUsingCoordinates) => ({
            //             routes: await Promise.all(
            //                 routesUsingCoordinates.map(async (routeUsingCoordinates, index) => ({
            //                     vehicle: fleetVehicles[index]._id,
            //                     directions: await googleMapsServicesAdapter.computeDirections(
            //                         routeUsingCoordinates[0],
            //                         routeUsingCoordinates[routeUsingCoordinates.length - 1],
            //                         routeUsingCoordinates.slice(1, routeUsingCoordinates.length - 1)
            //                     )
            //                 }))
            //             ),
            //             timestamp: new Date()
            //         }))
            //     );

            // Construct an array of bin collection schedule documents that can be directly inserted to the 
            // corresponding BinCollectionSchedule database collection later
            const setOfBinCollectionSchedules = 
                uniqueSetOfRoutesUsingIndex.map((routesUsingIndex) => ({
                    _id: new mongoose.Types.ObjectId(),
                    routes: routesUsingIndex.map((routeUsingIndex, index) => 
                        // If the number of nodes to visist in the computed route is found to be less than 2, 
                        // or more specifically, the route only contains -1, it indicates a route has been 
                        // found for a particular vehicle at index index, and hence such a route is replaced 
                        // by a null to ensure the validity of the bin collection schedule documents stored 
                        // in the database and the integrity of the entire system
                        routeUsingIndex.length < 2 ? null : ({
                            vehicle: fleetVehicles[index]._id,
                            visitingOrder: routeUsingIndex.map((nodeInIndex) => ({
                                longitude: dictFromMatrixIndexToDocument[nodeInIndex].longitude as number,
                                latitude: dictFromMatrixIndexToDocument[nodeInIndex].latitude as number
                            }))
                        })
                    ).filter(route => route !== null),
                    timestamp: new Date()
                }));
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "setOfBinCollectionSchedules", setOfBinCollectionSchedules, "\n");

            // Delete all the old bin collection schedule documents
            const oldBinCollectionSchedulesDeleteResult = await BinCollectionSchedule.deleteMany({});
            // Only continue if the delete operation of all old bin collection schedule documents succeeds above
            if (oldBinCollectionSchedulesDeleteResult.ok !== 1) {
                Logger.verboseError(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "oldBinCollectionSchedulesDeleteResult", oldBinCollectionSchedulesDeleteResult, "\n");
                throw new Error("Failed to delete old bin collection schedules");
            }
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "oldBinCollectionSchedulesDeleteResult", oldBinCollectionSchedulesDeleteResult, "\n");

            // Insert all the newly computed bin collection schedule documents
            const newBinCollectionSchedulesInsertResult = 
                await BinCollectionSchedule.insertMany(setOfBinCollectionSchedules, {
                    rawResult: true
                }) as unknown as mongooseInsertWriteOpResult;
            // Only continue if the insert operation of all the new bin collection schedule documents succeeds above
            if (newBinCollectionSchedulesInsertResult.result?.ok !== 1) {
                Logger.verboseError(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "newBinCollectionSchedulesInsertResult", newBinCollectionSchedulesInsertResult, "\n");
                throw new Error("Failed to insert new bin collection schedules");
            }
            Logger.verboseLog(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, "newBinCollectionSchedulesInsertResult", newBinCollectionSchedulesInsertResult, "\n");

            return true;
        } catch (error) {
            Logger.error(UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG, error, "\n");
            return false;
        }
    }
}
