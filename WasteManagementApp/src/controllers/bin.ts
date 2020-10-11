import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import { BIN_SEARCH_DISTANCE } from "../constants/misc"
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import BinDistance from "../models/bin-distance";
import BinCollectionSchedule from "../models/bin-collection-schedule";
import { DumbBinCreateInfo, DumbBinDeleteInfo, DumbBinUpdateInfo, mongooseInsertWriteOpResult } from "../utils/type-information";
import { GoogleMapsServicesAdapter } from "../utils/google-maps-services-adapter";
import { BinDistanceHelper } from "../utils/bin-distance-helper";
import { BinCollectionScheduleHelper } from "../utils/bin-collection-schedule-helper";

export async function getBins(request: express.Request, response: express.Response) {
    try {
        const smartBins = await SmartBin.find({});
        const dumbBins = await DumbBin.find({});
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
        });
    } catch(error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        console.error(error);
    }
}

export async function modifyBins(request: express.Request, response: express.Response) {
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

    try {
        const dumbBinsDeleteCreateUpdatebulkWriteResult = await DumbBin.bulkWrite(
            (dumbBinsDeleteBulkOperations as any[])
                .concat(dumbBinsCreateBulkOperations)
                .concat(dumbBinsUpdateBulkOperations)
        );

        if (dumbBinsDeleteCreateUpdatebulkWriteResult.result && 
            dumbBinsDeleteCreateUpdatebulkWriteResult.result.ok === 1 && 
            dumbBinsDeleteCreateUpdatebulkWriteResult.result.writeErrors.length === 0) {
            response.status(HTTP.CREATED).send(dumbBinsDeleteCreateUpdatebulkWriteResult.insertedIds);

            const dumbBinsCreateFormatted = dumbBinsCreate.map((dumbBin, index) => ({
                _id: dumbBinsDeleteCreateUpdatebulkWriteResult.insertedIds[index] as string,
                longitude: dumbBin.longitude,
                latitude: dumbBin.latitude,
            }));
            const dumbBinsUpdateFormatted = dumbBinsUpdate.map((dumbBin) => ({
                _id: dumbBin._id,
                longitude: dumbBin.longitude,
                latitude: dumbBin.latitude,
            }));
            const binDistancesInsertWriteResult = await BinDistance.insertMany(
                BinDistanceHelper.computeBinDistances(
                    request.app.get("GoogleMapsServices") as GoogleMapsServicesAdapter,
                    dumbBinsDelete,
                    dumbBinsCreateFormatted,
                    dumbBinsUpdateFormatted,
                    false
                ), {
                    rawResult: true
                }
            ) as unknown as mongooseInsertWriteOpResult;

            if (binDistancesInsertWriteResult.result && binDistancesInsertWriteResult.result.ok === 1) {
                const dumbBinsToBeUpdated = dumbBinsCreateFormatted.concat(dumbBinsUpdateFormatted);
                const nearestSmartBins = await Promise.all(
                    dumbBinsToBeUpdated.map((dumbBin) => 
                        SmartBin.findOne(
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
                        )
                    )
                );

                const dumbBinsUpdateOnNearestSmartBinBulkWriteResult = await DumbBin.bulkWrite(
                    nearestSmartBins.map((nearestSmartBin, index) => 
                        nearestSmartBin ? ({
                            updateOne: {
                                filter: {
                                    _id: dumbBinsToBeUpdated[index]._id,
                                },
                                update: {
                                    nearestSmartBin: nearestSmartBin._id
                                }
                            }
                        }) : null
                    ).filter(operation => operation)
                );

                if (dumbBinsUpdateOnNearestSmartBinBulkWriteResult.result &&   
                    (dumbBinsUpdateOnNearestSmartBinBulkWriteResult.result.ok !== 1 || 
                        dumbBinsUpdateOnNearestSmartBinBulkWriteResult.result.writeErrors.length !== 0)) {
                    console.error(dumbBinsUpdateOnNearestSmartBinBulkWriteResult);
                }
            } else {
                console.error(binDistancesInsertWriteResult);
            }
        } else {
            response.status(HTTP.BAD_REQUEST).send(dumbBinsDeleteCreateUpdatebulkWriteResult.result.writeErrors);
            console.error(dumbBinsDeleteCreateUpdatebulkWriteResult);
        }
    } catch(error) {
        response.status(HTTP.BAD_REQUEST).send(error.writeErrors);
        console.error(error);
    }

    if (dumbBinsCreate.length > 0 || dumbBinsDelete.length > 0 || dumbBinsUpdate.length > 0) {
        try {
            // Recompute the route by calling the recomputation routine
            const binCollectionSchedules = await BinCollectionScheduleHelper.createAllPossibleBinCollectionSchedules(
                request.app.get("GoogleMapsServices") as GoogleMapsServicesAdapter
            );
            const binCollectionSchedulesInsertWriteResult = await BinCollectionSchedule.insertMany(
                binCollectionSchedules.map(binCollectionSchedule => 
                    Object.assign(binCollectionSchedule, {
                        _id: new mongoose.Types.ObjectId()
                    })
                ), {
                    rawResult: true
                }
            ) as unknown as mongooseInsertWriteOpResult;
            if (binCollectionSchedulesInsertWriteResult.result && binCollectionSchedulesInsertWriteResult.result.ok === 1) {
                console.error(binCollectionSchedulesInsertWriteResult);
            }
        } catch(error) {
            console.error(error);
        }
    }
}
