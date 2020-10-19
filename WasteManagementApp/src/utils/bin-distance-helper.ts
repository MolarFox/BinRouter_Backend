import mongoose from "mongoose";
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import Depot from "../models/depot";
import BinDistance from "../models/bin-distance";
import { GoogleMapsServicesAdapter } from "./google-maps-services-adapter";
import { DeletedBinInfo, CreatedBinInfo, UpdatedBinInfo, BinDistanceInfo, DepotInfo, IdLatLng, DistanceMatrixElement, mongooseInsertWriteOpResult } from "./type-information";
import { Logger } from "./logger";
import { UPDATE_ALL_BIN_DISTANCES_LOG_TAG, UPDATE_BIN_DISTANCES_LOG_TAG } from "../constants/log-tag";

export class BinDistanceHelper {
    public static async updateAllBinDistances(
        googleMapsServicesAdapter: GoogleMapsServicesAdapter
    ): Promise<boolean> {
        try {
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
            const depots: IdLatLng[] = await Depot.aggregate([
                // Limited to only one depot in this project as the routing solver is unable to support multiple depots
                {
                    $limit: 1
                },
                projectPipelineStage
            ]);
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "depots", depots, "\n");

            const smartBins: IdLatLng[] = await SmartBin.aggregate([projectPipelineStage]);
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "smartBins", smartBins, "\n");

            const dumbBins: IdLatLng[] = await DumbBin.aggregate([projectPipelineStage]);
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "dumbBins", dumbBins, "\n");
            
            const origins = depots.concat(smartBins).concat(dumbBins);
            const originTypes = 
                ["Depot"].concat(new Array(smartBins.length).fill("SmartBin")).concat(new Array(dumbBins.length).fill("DumbBin"));
            const destinations = origins;
            const destinationTypes = originTypes;
            
            const allBinDistancesInfo = BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                await googleMapsServicesAdapter.computeDistanceMatrix(origins, destinations),
                origins,
                originTypes,
                destinations,
                destinationTypes
            );
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "allBinDistancesInfo", allBinDistancesInfo, "\n");
            
            const oldBinDistancesDeleteResult = await BinDistance.deleteMany({});
            if (oldBinDistancesDeleteResult.ok !== 1) {
                Logger.verboseError(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
                throw new Error("Failed to delete old bin distances");
            }
            Logger.verboseLog(UPDATE_ALL_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
            
            const newBinDistancesInsertResult = await BinDistance.insertMany(allBinDistancesInfo, {
                rawResult: true
            }) as unknown as mongooseInsertWriteOpResult;
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

    public static async updateBinDistances(
        googleMapsServicesAdapter: GoogleMapsServicesAdapter,
        deletedBinsInfo: DeletedBinInfo[], 
        createdBinsInfo: CreatedBinInfo[], 
        updatedBinsInfo: UpdatedBinInfo[],
        isSmart: boolean
    ): Promise<boolean> {
        try {
            const binsIdsDeleted = deletedBinsInfo.concat(updatedBinsInfo.map((updatedBinInfo) => updatedBinInfo._id));
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
            if (oldBinDistancesDeleteResult.ok !== 1) {
                Logger.verboseError(UPDATE_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
                throw new Error("Failed to delete old bin distances");
            }
            Logger.verboseLog(UPDATE_BIN_DISTANCES_LOG_TAG, "oldBinDistancesDeleteResult", oldBinDistancesDeleteResult, "\n");
            
            const binsCreated = createdBinsInfo.concat(updatedBinsInfo);

            if (binsCreated.length > 0) {
                const BinModelSameType = isSmart ? SmartBin : DumbBin;
                const BinModelDifferentType = isSmart ? DumbBin : SmartBin;
                const binsCreatedComplement: CreatedBinInfo[] = await BinModelSameType.aggregate([
                    {
                        $match: {
                            _id: {
                                $nin: binsCreated.map((bin) => new mongoose.Types.ObjectId(bin._id))
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

                const newBinDistancesInsertResult = await BinDistance.insertMany(binDistancesInfo, {
                        rawResult: true
                    }
                ) as unknown as mongooseInsertWriteOpResult;
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
