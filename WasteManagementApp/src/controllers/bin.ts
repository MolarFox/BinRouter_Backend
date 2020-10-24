import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import { GET_BINS_LOG_TAG, MODIFY_BINS_LOG_TAG } from "../constants/log-tag";
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import { BinCreateInfo, BinDeleteInfo, BinUpdateInfo, mongooseInsertWriteOpResult } from "../utils/type-information";
import { GoogleMapsServicesAdapter } from "../utils/google-maps-services-adapter";
import { BinDistanceHelper } from "../utils/bin-distance-helper";
import { BinCollectionScheduleHelper } from "../utils/bin-collection-schedule-helper";
import { BinHelper } from "../utils/bin-helper";
import { Logger } from "../utils/logger";

export async function getBins(request: express.Request, response: express.Response) {
    try {
        const smartBins = await SmartBin.find({});
        Logger.verboseLog(GET_BINS_LOG_TAG, "smartBins", smartBins, "\n");

        const dumbBins = await DumbBin.find({});
        Logger.verboseLog(GET_BINS_LOG_TAG, "dumbBins", dumbBins, "\n");

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
    } catch (error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_BINS_LOG_TAG, error, "\n");
    }
}

export async function modifyBins(request: express.Request, response: express.Response) {
    const dumbBinsDelete: any[] = Array.isArray(request.body.dumbBinsDelete) ? request.body.dumbBinsDelete : [];
    const dumbBinsCreate: any[] = Array.isArray(request.body.dumbBinsCreate) ? request.body.dumbBinsCreate : [];
    const dumbBinsUpdate: any[] = Array.isArray(request.body.dumbBinsUpdate) ? request.body.dumbBinsUpdate : [];

    const dumbBinsDeleteCheckResults: boolean[] = dumbBinsDelete.map(BinHelper.verifyDumbBinDeleteInfo);
    const dumbBinsCreateCheckResults: boolean[] = dumbBinsCreate.map(BinHelper.verifyDumbBinCreateInfo);
    const dumbBinsUpdateCheckResults: boolean[] = dumbBinsUpdate.map(BinHelper.verifyDumbBinUpdateInfo);
    
    if (!dumbBinsDeleteCheckResults.every(result => result) || 
        !dumbBinsCreateCheckResults.every(result => result) || 
        !dumbBinsUpdateCheckResults.every(result => result)) {
        response.status(HTTP.BAD_REQUEST).json({
            message: "Malformed content is detected in the three arrays contained in the request body",
            dumbBinsDeleteMalformedContentIndexes: dumbBinsDeleteCheckResults
                                                        .map((isMatched, index) => !isMatched ? index : undefined)
                                                        .filter(index => index !== undefined),
            dumbBinsCreateMalformedContentIndexes: dumbBinsCreateCheckResults
                                                        .map((isMatched, index) => !isMatched ? index : undefined)
                                                        .filter(index => index !== undefined),
            dumbBinsUpdateMalformedContentIndexes: dumbBinsUpdateCheckResults
                                                        .map((isMatched, index) => !isMatched ? index : undefined)
                                                        .filter(index => index !== undefined)
        });
        return;
    }

    // check if all of these arrays are empty or not
    try {
        const dumbBinsCreateWithIdsAdded = dumbBinsCreate.map(
            (dumbBinCreate) => Object.assign(dumbBinCreate, {
                _id: new mongoose.Types.ObjectId()
            })
        );
        if (dumbBinsDelete.length > 0 || dumbBinsCreate.length > 0 || dumbBinsUpdate.length > 0) {
            const dumbBinsUpdateBulkWriteResult = await BinHelper.updateBins(
                dumbBinsDelete as BinDeleteInfo[],
                dumbBinsCreateWithIdsAdded as BinCreateInfo[],
                dumbBinsUpdate as BinUpdateInfo[],
                false
            );
            if (!dumbBinsUpdateBulkWriteResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateBulkWriteResult", dumbBinsUpdateBulkWriteResult, "\n");
                throw new Error("Failed to update dumb bins");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateBulkWriteResult", dumbBinsUpdateBulkWriteResult, "\n");
        }

        response.status(HTTP.CREATED).json({
            insertedIds: dumbBinsCreateWithIdsAdded.map(dumbBinCreate => dumbBinCreate._id)
        });

        if (dumbBinsDelete.length > 0 || dumbBinsCreate.length > 0 || dumbBinsUpdate.length > 0) {
            const binDistancesUpdateResult = await BinDistanceHelper.updateBinDistances(
                request.app.get("GoogleMapsServicesAdapter") as GoogleMapsServicesAdapter,
                dumbBinsDelete,
                dumbBinsCreateWithIdsAdded,
                dumbBinsUpdate,
                false
            );
            if (!binDistancesUpdateResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "binDistancesUpdateResult", binDistancesUpdateResult, "\n");
                throw new Error("Failed to update bins distances");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "binDistancesUpdateResult", binDistancesUpdateResult, "\n");

            const dumbBinsUpdateOnNearestSmartBinsResult = await BinHelper.updateNearestSmartBins(
                dumbBinsCreateWithIdsAdded.concat(dumbBinsUpdate)
            );
            if (!dumbBinsUpdateOnNearestSmartBinsResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateOnNearestSmartBinsResult", dumbBinsUpdateOnNearestSmartBinsResult, "\n");
                throw new Error("Failed to update dumb bins' nearest smart bins");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateOnNearestSmartBinsResult", dumbBinsUpdateOnNearestSmartBinsResult, "\n");

            const binCollectionSchedulesUpdateResult = await BinCollectionScheduleHelper.updateBinCollectionSchedules();
            if (!binCollectionSchedulesUpdateResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
                throw new Error("Failed to update bin collection schedules");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
        }
    } catch (error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(error, "\n");
    }
}
