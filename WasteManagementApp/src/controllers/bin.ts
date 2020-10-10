import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import * as MISC from "../constants/misc"
import { DistanceMatrixElement, GoogleMapsServicesAdapter, LatLng } from "../utils/google-maps-services-adapter";
import { BinDistanceInfo, CreatedBinInfo, DeletedBinInfo, DepotInfo, DumbBinCreateInfo, DumbBinDeleteInfo, DumbBinUpdateInfo, mongooseInsertWriteOpResult, UpdatedBinInfo } from "../utils/type-information";
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import Depot from "../models/depot";
import BinDistance from "../models/bin-distance";
import { BinDistanceHelper } from "../utils/bin-distance-helper";

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
                    BinDistance.insertMany(
                        BinDistanceHelper.computeBinDistances(
                            request.app.get("GoogleMapsServices") as GoogleMapsServicesAdapter,
                            dumbBinsDelete,
                            dumbBinsCreateFormatted,
                            dumbBinsUpdateFormatted,
                            false
                        ), 
                        {
                            rawResult: true
                        }
                    ) as unknown as Promise<mongooseInsertWriteOpResult>,
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
