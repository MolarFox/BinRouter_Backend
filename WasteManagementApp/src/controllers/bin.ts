import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import BinCollectionSchedule from "../models/bin-collection-schedule";
import { BinCreateInfo, BinDeleteInfo, BinUpdateInfo, mongooseInsertWriteOpResult } from "../utils/type-information";
import { GoogleMapsServicesAdapter } from "../utils/google-maps-services-adapter";
import { BinDistanceHelper } from "../utils/bin-distance-helper";
import { BinCollectionScheduleHelper } from "../utils/bin-collection-schedule-helper";
import { BinHelper } from "../utils/bin-helper";

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
    const dumbBinsDelete: BinDeleteInfo[] = Array.isArray(request.body.dumbBinsDelete) ? request.body.dumbBinsDelete : [];
    const dumbBinsCreate: BinCreateInfo[] = Array.isArray(request.body.dumbBinsCreate) ? request.body.dumbBinsCreate : [];
    const dumbBinsUpdate: BinUpdateInfo[] = Array.isArray(request.body.dumbBinsUpdate) ? request.body.dumbBinsUpdate : [];

    // check if all of these arrays are empty or not
    try {
        const dumbBinsDeleteCreateUpdateBulkWriteResult = await BinHelper.updateBins(
            dumbBinsDelete,
            dumbBinsCreate,
            dumbBinsUpdate,
            false
        );
        console.log(dumbBinsDeleteCreateUpdateBulkWriteResult);

        if (dumbBinsDeleteCreateUpdateBulkWriteResult.result?.ok === 1 && 
            dumbBinsDeleteCreateUpdateBulkWriteResult.result?.writeErrors.length === 0) {
            response.status(HTTP.CREATED).send(dumbBinsDeleteCreateUpdateBulkWriteResult.insertedIds);

            const dumbBinsCreateFormatted = dumbBinsCreate.map((dumbBin, index) => ({
                _id: dumbBinsDeleteCreateUpdateBulkWriteResult.insertedIds[index] as string,
                longitude: dumbBin.longitude,
                latitude: dumbBin.latitude,
            }));
            const dumbBinsUpdateFormatted = dumbBinsUpdate.map((dumbBin) => ({
                _id: dumbBin._id,
                longitude: dumbBin.longitude,
                latitude: dumbBin.latitude,
            }));
            const binDistancesUpdateResult = await BinDistanceHelper.updateBinDistances(
                request.app.get("GoogleMapsServicesAdapter") as GoogleMapsServicesAdapter,
                dumbBinsDelete,
                dumbBinsCreateFormatted,
                dumbBinsUpdateFormatted,
                false
            );

            if (binDistancesUpdateResult) {
                const dumbBinsUpdateOnNearestSmartBinBulkWriteResult = 
                    await BinHelper.updateNearestSmartBins(
                        dumbBinsCreateFormatted.concat(dumbBinsUpdateFormatted)
                    );

                if (dumbBinsUpdateOnNearestSmartBinBulkWriteResult.result?.ok !== 1 || 
                    dumbBinsUpdateOnNearestSmartBinBulkWriteResult.result?.writeErrors.length !== 0) {
                    console.error(dumbBinsUpdateOnNearestSmartBinBulkWriteResult);
                }
            } else {
                console.error(binDistancesUpdateResult);
            }
        } else {
            response.status(HTTP.BAD_REQUEST).send(dumbBinsDeleteCreateUpdateBulkWriteResult.result.writeErrors);
            console.error(dumbBinsDeleteCreateUpdateBulkWriteResult);
        }
    } catch(error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send(error.writeErrors);
        console.error(error);
    }

    if (dumbBinsCreate.length > 0 || dumbBinsDelete.length > 0 || dumbBinsUpdate.length > 0) {
        try {
            // Recompute the route by calling the recomputation routine
            const binCollectionSchedulesInsertWriteResult = await BinCollectionScheduleHelper.updateBinCollectionSchedules(
                request.app.get("GoogleMapsServicesAdapter") as GoogleMapsServicesAdapter
            );
            if (binCollectionSchedulesInsertWriteResult.result?.ok === 1) {
                console.error(binCollectionSchedulesInsertWriteResult);
            }
        } catch(error) {
            console.error(error);
        }
    }
}
