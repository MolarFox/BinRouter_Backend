import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import * as MISC from "../constants/misc"
import { DistanceMatrixElement, GoogleMapsServices, LatLng } from "../utils/google-maps-services";
import { BinDistanceInfo, CreatedBinInfo, DeletedBinInfo, DepotInfo, DumbBinCreateInfo, DumbBinDeleteInfo, DumbBinUpdateInfo, mongooseInsertWriteOpResult, UpdatedBinInfo } from "../utils/type-information";
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import Depot from "../models/depot";
import BinDistance from "../models/bin-distance";

export function getBins(request: express.Request, response: express.Response) {
    Promise
        .all([
            SmartBin.find({}),
            DumbBin.find({})
        ])
        .then(([smartBins, dumbBins]) => 
            response.status(HTTP.OK).json({
                bins: (smartBins.map((smartBin: any) => ({
                    _id: smartBin._id,
                    serial_number: smartBin.serial_number,
                    longitude: smartBin.location.coordinates[0],
                    latitude: smartBin.location.coordinates[1],
                    address: smartBin.address,
                    capacity: smartBin.capacity,
                    threshold: smartBin.threshold,
                    currentFullness: smartBin.currentFullness,
                    isSmart: true
                })) as any[]).concat(dumbBins.map((dumbBin: any) => ({
                    _id: dumbBin._id,
                    longitude: dumbBin.location.coordinates[0],
                    latitude: dumbBin.location.coordinates[1],
                    address: dumbBin.address,
                    capacity: dumbBin.capacity,
                    isSmart: false
                })))
            })
        )
        .catch((error) => console.error(error));
}

export function modifyBins(request: express.Request, response: express.Response) {
    const dumbBinsDelete: DumbBinDeleteInfo[] = Array.isArray(request.body.dumbBinsDelete) ? request.body.dumbBinsDelete : [];
    const dumbBinsCreate: DumbBinCreateInfo[] = Array.isArray(request.body.dumbBinsCreate) ? request.body.dumbBinsCreate : [];
    const dumbBinsUpdate: DumbBinUpdateInfo[] = Array.isArray(request.body.dumbBinsUpdate) ? request.body.dumbBinsUpdate : [];

    const dumbBinsDeleteBulkOperations = dumbBinsDelete.map((_id) => ({
        deleteOne: {
            filter: { 
                _id: _id
            }
        }
    }));
    const dumbBinsCreateBulkOperations = dumbBinsCreate.map((dumbBin) => ({
        insertOne: {
            document: {
                _id: new mongoose.Types.ObjectId(),
                location: {
                    type: "Point",
                    coordinates: [dumbBin.longitude, dumbBin.latitude]
                },
                address: dumbBin.address,
                capacity: dumbBin.capacity,
            }
        }
    }));
    const dumbBinsUpdateBulkOperations = dumbBinsUpdate.map((dumbBin) => ({
        updateOne: {
            filter: {
                _id: dumbBin._id,
            },
            update: {
                location: {
                    type: "Point",
                    coordinates: [dumbBin.longitude, dumbBin.latitude]
                },
                address: dumbBin.address,
                capacity: dumbBin.capacity,
                nearestSmartBin: undefined
            }
        }
    }));

    Promise
        .resolve()
        .then(() => 
            DumbBin.bulkWrite((dumbBinsDeleteBulkOperations as any[]).concat(dumbBinsCreateBulkOperations).concat(dumbBinsUpdateBulkOperations))
        )
        .then((bulkWriteOperationResult) => {
            if (bulkWriteOperationResult.result && bulkWriteOperationResult.result.ok === 1 && bulkWriteOperationResult.result.writeErrors.length === 0) {
                response.status(HTTP.CREATED).send(bulkWriteOperationResult.insertedIds);
                
                const dumbBinsCreateFormatted = dumbBinsCreate.map((dumbBin, index) => ({
                    _id: bulkWriteOperationResult.insertedIds[index] as string,
                    longitude: dumbBin.longitude,
                    latitude: dumbBin.latitude,
                }));
                const dumbBinsUpdateFormatted = dumbBinsUpdate.map((dumbBin) => ({
                    _id: dumbBin._id,
                    longitude: dumbBin.longitude,
                    latitude: dumbBin.latitude,
                }));
                return Promise.all([
                    // Recompute the bin distances using google maps computeDistanceMatrix
                    updateBinDistances(
                        request.app.get("GoogleMapsServices") as GoogleMapsServices,
                        dumbBinsDelete,
                        dumbBinsCreateFormatted,
                        dumbBinsUpdateFormatted,
                        false
                    ),
                    dumbBinsCreateFormatted.concat(dumbBinsUpdateFormatted)
                ]);
            } else {
                return Promise.reject(bulkWriteOperationResult.result);
            }
        })
        .then(([insertWriteOperationResult, dumbBinsToBeUpdated]) => {
            if (insertWriteOperationResult.result && insertWriteOperationResult.result.ok === 1) {
                return Promise
                        .all(dumbBinsToBeUpdated.map((dumbBin) => {
                            return SmartBin.findOne(
                                {
                                    location: {
                                        $near: {
                                            $geometry: {
                                                type: "Point",
                                                coordinates: [dumbBin.longitude, dumbBin.latitude]
                                            },
                                            $maxDistance: MISC.BIN_SEARCH_DISTANCE
                                        }
                                    }
                                },
                                "_id"
                            );
                        }))
                        .then((nearestSmartBins) => {
                            return nearestSmartBins.map((nearestSmartBin, index) => nearestSmartBin ? ({
                                updateOne: {
                                    filter: {
                                        _id: dumbBinsToBeUpdated[index]._id,
                                    },
                                    update: {
                                        nearestSmartBin: nearestSmartBin._id
                                    }
                                }
                            }) : null).filter(operation => operation);
                        })
                        .then((dumbBinsUpdateBulkOperations) => DumbBin.bulkWrite(dumbBinsUpdateBulkOperations));
            } else {
                return Promise.reject(insertWriteOperationResult.result);
            }
        })
        .then((bulkWriteOperationResult) => {
            if (!bulkWriteOperationResult.result || bulkWriteOperationResult.result.ok !== 1 && bulkWriteOperationResult.result.writeErrors.length !== 0) {
                return Promise.reject(bulkWriteOperationResult.result);
            }
        })
        .catch((error) => {
            console.error(error);
            response.status(HTTP.BAD_REQUEST).send(error);
        });

    if (dumbBinsCreate.length > 0 || dumbBinsDelete.length > 0 || dumbBinsUpdate.length > 0) {
        // Recompute the route by calling the recomputation routine
    }
}

interface IdLatLng extends LatLng {
    _id: string
}

export function updateBinDistances(
    googleMapsServices: GoogleMapsServices,
    deletedBinsInfo: DeletedBinInfo[], 
    createdBinsInfo: CreatedBinInfo[], 
    updatedBinsInfo: UpdatedBinInfo[],
    isSmart: boolean
): Promise<mongooseInsertWriteOpResult> {
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
                            convertFromDistanceMatrixToBinDistanceDocuments(
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
                            convertFromDistanceMatrixToBinDistanceDocuments(
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
                            convertFromDistanceMatrixToBinDistanceDocuments(
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
                            convertFromDistanceMatrixToBinDistanceDocuments(
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
                            convertFromDistanceMatrixToBinDistanceDocuments(
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
                            convertFromDistanceMatrixToBinDistanceDocuments(
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
                            convertFromDistanceMatrixToBinDistanceDocuments(
                                distancematrix, 
                                depots, 
                                "Depot", 
                                binsCreated, 
                                isSmart ? "SmartBin" : "DumbBin"
                            )
                        ), 
                ]); 
            })
            .then((binDistancesInfo) => {
                return BinDistance.insertMany(
                    binDistancesInfo.flatMap(binDistanceInfo => binDistanceInfo), 
                    {
                        rawResult: true
                    }
                ) as unknown as Promise<mongooseInsertWriteOpResult>
            });
}

export function convertFromDistanceMatrixToBinDistanceDocuments(
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