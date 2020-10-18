import { BulkWriteOpResultObject } from "mongodb";
import mongoose from "mongoose";
import { BIN_SEARCH_DISTANCE } from "../constants/misc";
import DumbBin from "../models/dumb-bin";
import SmartBin from "../models/smart-bin";
import { BinCreateInfo, BinDeleteInfo, BinUpdateInfo, IdLatLng, LatLng } from "./type-information";

export class BinHelper {
    public static computeNearestSmartBins(dumbBins: LatLng[]): Promise<(string | null)[]> {
        return Promise.all(
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
        )
    }

    public static updateNearestSmartBins(dumbBins: IdLatLng[]): Promise<BulkWriteOpResultObject> {
        return BinHelper
                .computeNearestSmartBins(dumbBins)
                .then((nearestSmartBins) => 
                    DumbBin.bulkWrite(
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
                    )
                );
    }

    public static updateBins(
        binsDeleteInfo: BinDeleteInfo[],
        binsCreateInfo: BinCreateInfo[],
        binsUpdateInfo: BinUpdateInfo[],
        isSmart: boolean
    ): Promise<BulkWriteOpResultObject> {
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
                    _id: new mongoose.Types.ObjectId(),
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

        return (isSmart ? SmartBin : DumbBin).bulkWrite(
            (binsCreateBulkOperations as any[])
                .concat(binsDeleteBulkOperations)
                .concat(binsUpdateBulkOperations)
        );
    }
}
