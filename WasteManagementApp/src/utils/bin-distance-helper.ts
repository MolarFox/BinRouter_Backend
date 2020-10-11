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
    public static async computeBinDistances(
        googleMapsServices: GoogleMapsServicesAdapter,
        deletedBinsInfo: DeletedBinInfo[], 
        createdBinsInfo: CreatedBinInfo[], 
        updatedBinsInfo: UpdatedBinInfo[],
        isSmart: boolean
    ): Promise<BinDistanceInfo[]> {
        const binsIdsDeleted = deletedBinsInfo.concat(updatedBinsInfo.map((updatedBinInfo) => updatedBinInfo._id));
        const deleteResult = binsIdsDeleted.length > 0 ? 
            await BinDistance.deleteMany({
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
            }) : {
                ok: 1
            };
        
        let binDistancesInfo: BinDistanceInfo[] = [];
        
        if (deleteResult.ok === 1) {
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
                binDistancesInfo = [
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServices.computeDistanceMatrix(binsCreated, binsCreated), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ),
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServices.computeDistanceMatrix(binsCreated, binsCreatedComplement), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsCreatedComplement, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServices.computeDistanceMatrix(binsCreatedComplement, binsCreated), 
                        binsCreatedComplement, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServices.computeDistanceMatrix(binsCreated, binsDifferentType), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        binsDifferentType, 
                        isSmart ? "DumbBin" : "SmartBin"
                    ),
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServices.computeDistanceMatrix(binsDifferentType, binsCreated), 
                        binsDifferentType, 
                        isSmart ? "DumbBin" : "SmartBin", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServices.computeDistanceMatrix(binsCreated, depots), 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin", 
                        depots, 
                        "Depot"
                    ), 
                    BinDistanceHelper.convertFromDistanceMatrixToBinDistanceDocuments(
                        await googleMapsServices.computeDistanceMatrix(depots, binsCreated), 
                        depots, 
                        "Depot", 
                        binsCreated, 
                        isSmart ? "SmartBin" : "DumbBin"
                    ), 
                ].flatMap(binDistanceInfo => binDistanceInfo);
            }
        }
        
        return binDistancesInfo;
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
