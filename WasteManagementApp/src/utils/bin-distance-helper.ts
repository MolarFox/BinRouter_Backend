import mongoose from "mongoose";
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import Depot from "../models/depot";
import BinDistance from "../models/bin-distance";
import { DistanceMatrixElement, GoogleMapsServicesAdapter, LatLng } from "./google-maps-services-adapter";
import { DeletedBinInfo, CreatedBinInfo, UpdatedBinInfo, BinDistanceInfo, DepotInfo } from "./type-information";

interface IdLatLng extends LatLng {
    _id: string
}

export class BinDistanceHelper {
    public static computeBinDistances(
        googleMapsServices: GoogleMapsServicesAdapter,
        deletedBinsInfo: DeletedBinInfo[], 
        createdBinsInfo: CreatedBinInfo[], 
        updatedBinsInfo: UpdatedBinInfo[],
        isSmart: boolean
    ): Promise<BinDistanceInfo[]> {
        return Promise
                .resolve()
                .then(() => {
                    const binsIdsDeleted = deletedBinsInfo.concat(updatedBinsInfo.map((updatedBinInfo) => updatedBinInfo._id));
                    if (binsIdsDeleted.length > 0) {
                        return BinDistance.deleteMany({
                            $or: [
                                {
                                    $and: [
                                        {
                                            originType: isSmart ? "SmartBin" : "DumbBin"
                                        },
                                        {
                                            origin: {
                                                $in: binsIdsDeleted
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
                                                $in: binsIdsDeleted
                                            }
                                        }
                                    ]
                                }
                            ]
                        });
                    } else {
                        return Promise.resolve({
                            ok: 1
                        });
                    }
                })
                .then((result) => {
                    if (result.ok === 1) {
                        const binsCreated = createdBinsInfo.concat(updatedBinsInfo);
                        if (binsCreated.length > 0) {
                            const BinModelSameType = isSmart ? SmartBin : DumbBin;
                            const BinModelDifferentType = isSmart ? DumbBin : SmartBin;
                            const binsCreatedComplement = BinModelSameType.aggregate([
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
                            ]).then(bins => bins);
                            const binsDifferentType = BinModelDifferentType.aggregate([
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
                            ]).then(bins => bins);
                            const depots = Depot.aggregate([
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
                            ]).then(depots => depots);
                            return Promise.all([
                                binsCreated, 
                                binsCreatedComplement as unknown as Promise<CreatedBinInfo[]>, 
                                binsDifferentType as unknown as Promise<CreatedBinInfo[]>,
                                depots as unknown as Promise<DepotInfo[]>
                            ]);
                        } else {
                            return Promise.resolve([]) as unknown as Promise<[CreatedBinInfo[], CreatedBinInfo[], CreatedBinInfo[], DepotInfo[]]>;
                        }
                    } else {
                        return Promise.reject(result);
                    }
                })
                .then(([binsCreated, binsCreatedComplement, binsDifferentType, depots]) => {
                    return Promise.all([
                        googleMapsServices
                            .computeDistanceMatrix(binsCreated, binsCreated)
                            .then((distancematrix) => 
                                BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                                    distancematrix, 
                                    binsCreated, 
                                    isSmart ? "SmartBin" : "DumbBin", 
                                    binsCreated, 
                                    isSmart ? "SmartBin" : "DumbBin"
                                )
                            ), 
                        googleMapsServices
                            .computeDistanceMatrix(binsCreated, binsCreatedComplement)
                            .then((distancematrix) => 
                                BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                                    distancematrix, 
                                        binsCreated, 
                                        isSmart ? "SmartBin" : "DumbBin", 
                                        binsCreatedComplement, 
                                        isSmart ? "SmartBin" : "DumbBin"
                                )
                            ), 
                        googleMapsServices
                            .computeDistanceMatrix(binsCreatedComplement, binsCreated)
                            .then((distancematrix) => 
                                BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                                    distancematrix, 
                                    binsCreatedComplement, 
                                    isSmart ? "SmartBin" : "DumbBin", 
                                    binsCreated, 
                                    isSmart ? "SmartBin" : "DumbBin"
                                )
                            ), 
                        googleMapsServices
                            .computeDistanceMatrix(binsCreated, binsDifferentType)
                            .then((distancematrix) => 
                                BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                                    distancematrix, 
                                    binsCreated, 
                                    isSmart ? "SmartBin" : "DumbBin", 
                                    binsDifferentType, 
                                    isSmart ? "DumbBin" : "SmartBin"
                                )
                            ), 
                        googleMapsServices
                            .computeDistanceMatrix(binsDifferentType, binsCreated)
                            .then((distancematrix) => 
                                BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                                    distancematrix, 
                                    binsDifferentType, 
                                    isSmart ? "DumbBin" : "SmartBin", 
                                    binsCreated, 
                                    isSmart ? "SmartBin" : "DumbBin"
                                )
                            ), 
                        googleMapsServices
                            .computeDistanceMatrix(binsCreated, depots)
                            .then((distancematrix) => 
                                BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                                    distancematrix, 
                                    binsCreated, 
                                    isSmart ? "SmartBin" : "DumbBin", 
                                    depots, 
                                    "Depot"
                                )
                            ), 
                        googleMapsServices
                            .computeDistanceMatrix(depots, binsCreated)
                            .then((distancematrix) => 
                                BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                                    distancematrix, 
                                    depots, 
                                    "Depot", 
                                    binsCreated, 
                                    isSmart ? "SmartBin" : "DumbBin"
                                )
                            ), 
                    ]); 
                })
                .then((binDistancesInfo) => binDistancesInfo.flatMap(binDistanceInfo => binDistanceInfo));
    }
    
    public static convertFromDistanceMatrixToBinDistanceDocuments(
        distanceMatrix: DistanceMatrixElement[][], 
        origins: IdLatLng[],
        originType: string,
        destinations: IdLatLng[],
        destinationType: string
    ): BinDistanceInfo[] {
        return (
            distanceMatrix.flatMap((row, originIndex) => 
                row.map((col, destinationIndex) => ({
                    origin: origins[originIndex]._id,
                    originType: originType,
                    destination: destinations[destinationIndex]._id,
                    destinationType: destinationType,
                    distance: col.distance,
                    duration: col.duration
                }))
            )
        );
    }
}
