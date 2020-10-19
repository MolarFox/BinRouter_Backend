import mongoose from "mongoose";
import { COMPUTE_NEAREST_SMART_BINS_LOG_TAG, UPDATE_BINS_LOG_TAG, UPDATE_NEAREST_SMART_BINS_LOG_TAG } from "../constants/log-tag";
import { BIN_SEARCH_DISTANCE } from "../constants/misc";
import DumbBin from "../models/dumb-bin";
import SmartBin from "../models/smart-bin";
import { Logger } from "./logger";
import { BinCreateInfo, BinDeleteInfo, BinUpdateInfo, IdLatLng, LatLng } from "./type-information";

export class BinHelper {
    public static async computeNearestSmartBins(dumbBins: LatLng[]): Promise<(string | null)[]> {
        const nearestSmartBins: (string | null)[] = await Promise.all(
            dumbBins.map(async (dumbBin) => 
                (await SmartBin.findOne(
                    {
                        location: {
                            $near: {
                                $geometry: {
                                    type: "Point",
                                    coordinates: [dumbBin.longitude, dumbBin.latitude]
                                },
                                $maxDistance: BIN_SEARCH_DISTANCE
                            }
                        }
                    },
                    "_id"
                ))?._id
            )
        );
        Logger.verboseLog(COMPUTE_NEAREST_SMART_BINS_LOG_TAG, "nearestSmartBins", nearestSmartBins, "\n");
        return nearestSmartBins;
    }

    public static async updateNearestSmartBins(dumbBins: IdLatLng[]): Promise<boolean> {
        try {
            const nearestSmartBins = await BinHelper.computeNearestSmartBins(dumbBins);
            Logger.verboseLog(UPDATE_NEAREST_SMART_BINS_LOG_TAG, "nearestSmartBins", nearestSmartBins, "\n");
            
            const dumbBinsUpdateOnNearestSmartBinsBulkWriteResult = await DumbBin.bulkWrite(
                nearestSmartBins.map((nearestSmartBin, index) => ({
                    updateOne: {
                        filter: {
                            _id: dumbBins[index]._id,
                        },
                        update: {
                            nearestSmartBin: nearestSmartBin ? nearestSmartBin : undefined
                        }
                    }
                }))
            );
            if (dumbBinsUpdateOnNearestSmartBinsBulkWriteResult.result?.ok !== 1 ||  
                dumbBinsUpdateOnNearestSmartBinsBulkWriteResult.result?.writeErrors.length !== 0) {
                Logger.verboseError(
                    UPDATE_NEAREST_SMART_BINS_LOG_TAG, 
                    "dumbBinsUpdateOnNearestSmartBinsBulkWriteResult", 
                    dumbBinsUpdateOnNearestSmartBinsBulkWriteResult, 
                    "\n"
                );
            } 
            Logger.verboseLog(
                UPDATE_NEAREST_SMART_BINS_LOG_TAG, 
                "dumbBinsUpdateOnNearestSmartBinsBulkWriteResult", 
                dumbBinsUpdateOnNearestSmartBinsBulkWriteResult, 
                "\n"
            );

            return true;
        } catch (error) {
            Logger.error(UPDATE_NEAREST_SMART_BINS_LOG_TAG, error, "\n");
            return false;
        }
    }

    public static async updateBins(
        binsDeleteInfo: BinDeleteInfo[],
        binsCreateInfo: BinCreateInfo[],
        binsUpdateInfo: BinUpdateInfo[],
        isSmart: boolean
    ): Promise<boolean> {
        try {
            const binsDeleteBulkOperations = binsDeleteInfo.map((_id) => ({
                deleteOne: {
                    filter: { 
                        _id: new mongoose.Types.ObjectId(_id)
                    }
                }
            }));
            const binsCreateBulkOperations = binsCreateInfo.map((bin) => ({
                insertOne: {
                    document: Object.assign({
                        _id: new mongoose.Types.ObjectId(bin._id),
                        location: {
                            type: "Point",
                            coordinates: [bin.longitude, bin.latitude]
                        },
                        address: bin.address,
                        capacity: bin.capacity,
                    }, isSmart ? {
                        serialNumber: bin.serialNumber!,
                        threshold: bin.threshold!,
                        lastUpdated: bin.lastUpdated!
                    } : {})
                }
            }));
            const binsUpdateBulkOperations = binsUpdateInfo.map((bin) => ({
                updateOne: {
                    filter: {
                        _id: new mongoose.Types.ObjectId(bin._id)
                    },
                    update: Object.assign({
                        location: {
                            type: "Point",
                            coordinates: [bin.longitude, bin.latitude]
                        },
                        address: bin.address,
                        capacity: bin.capacity
                    }, isSmart ? {
                        threshold: bin.threshold!,
                        lastUpdated: bin.lastUpdated!
                    } : {
                        nearestSmartBin: undefined
                    })
                }
            }));

            const binsUpdateBulkWriteResult = await (isSmart ? SmartBin : DumbBin).bulkWrite(
                (binsDeleteBulkOperations as any[]).concat(binsCreateBulkOperations).concat(binsUpdateBulkOperations)
            );
            if (binsUpdateBulkWriteResult.result?.ok !== 1 || 
                binsUpdateBulkWriteResult.result?.writeErrors.length !== 0) {
                Logger.verboseError(UPDATE_BINS_LOG_TAG, "binsUpdateBulkWriteResult", binsUpdateBulkWriteResult, "\n");
                throw new Error(`Failed to update ${isSmart ? "smart" : "dumb"} bins`);
            } 
            Logger.verboseLog(UPDATE_BINS_LOG_TAG, "binsUpdateBulkWriteResult", binsUpdateBulkWriteResult, "\n");
            
            return true;
        } catch (error) {
            Logger.error(UPDATE_BINS_LOG_TAG, error, "\n");
            return false;
        }
    }
}
