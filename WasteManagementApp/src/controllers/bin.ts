/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes all the bin-related HTTP request handler functions. It provides the functionality 
 * of handling a GET request to retrieve all the smart bins and dumb bins currently stored in the database, and 
 * handling a PUT reuquest to modify the dumb bins (i.e., including create a new one, delete an existing one, and 
 * update an existing one) according to the information specified in the request body.
 */

import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import { GET_BINS_LOG_TAG, MODIFY_BINS_LOG_TAG } from "../constants/log-tag";
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import { BinCreateInfo, BinDeleteInfo, BinUpdateInfo } from "../utils/type-information";
import { GoogleMapsServicesAdapter } from "../utils/google-maps-services-adapter";
import { BinDistanceHelper } from "../utils/bin-distance-helper";
import { BinCollectionScheduleHelper } from "../utils/bin-collection-schedule-helper";
import { BinHelper } from "../utils/bin-helper";
import { Logger } from "../utils/logger";

/**
 * Handle an incoming HTTP GET request to retrieve all the smart bins and dumb bins currently stored in the database
 * 
 * @async
 * @param {express.Request} request an incoming HTTP GET request object containing the parsed request body
 * @param {express.Response} response an outgoing response to the incoming HTTP GET request containing the information to be sent back
 * 
 * @returns {void}
 */
export async function getBins(request: express.Request, response: express.Response) {
    try {
        // smartBins stores all the smart bins currently stored in the database
        const smartBins = await SmartBin.find({});
        Logger.verboseLog(GET_BINS_LOG_TAG, "smartBins", smartBins, "\n");

        // dumbBins stores all the dumb bins currently stored in the database
        const dumbBins = await DumbBin.find({});
        Logger.verboseLog(GET_BINS_LOG_TAG, "dumbBins", dumbBins, "\n");

        // Merge both smartBins and dumbBins into one and format them into appropriate forms with an extra property of isSmart
        // being boolean to identify whether the document in the merged array represents a smart bin or a dumb bin, and then 
        // send them as the response body with the status code being OK (200) back to the requesting client
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
        // As any errors that may be encountered in the above section must be a server erorr, send an empty response body 
        // with the status code being INTERNAL_SERVER_ERROR (500) back to the client in this case
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_BINS_LOG_TAG, error, "\n");
    }
}

/**
 * Handle an incoming HTTP PUT request to modify the dumb bins in the database according to the information specified 
 * in the request body
 * 
 * @async
 * @param {express.Request} request an incoming HTTP PUT request object containing the parsed request body
 * @param {express.Response} response an outgoing response to the incoming HTTP PUT request containing the information to be sent back
 * 
 * @returns {void}
 */
export async function modifyBins(request: express.Request, response: express.Response) {
    // dumbBinsDelete should store an array of strings each representing the ID of an existing dumb bin that is to be deleted later
    const dumbBinsDelete: any[] = Array.isArray(request.body.dumbBinsDelete) ? request.body.dumbBinsDelete : [];
    // dumbBinsCreate should store an array of objects each representing a new dumb bin that is to be created later
    const dumbBinsCreate: any[] = Array.isArray(request.body.dumbBinsCreate) ? request.body.dumbBinsCreate : [];
    // dumbBinsUpdate should store an array of objects each representing an existing dumb bin that is to be updated accordingly later
    const dumbBinsUpdate: any[] = Array.isArray(request.body.dumbBinsUpdate) ? request.body.dumbBinsUpdate : [];

    // Verify whether the content of each array contained in the request body has the valid format which can be used in forming 
    // the database bulk operations below without errors
    const dumbBinsDeleteCheckResults: boolean[] = dumbBinsDelete.map(BinHelper.verifyDumbBinDeleteInfo);
    const dumbBinsCreateCheckResults: boolean[] = dumbBinsCreate.map(BinHelper.verifyDumbBinCreateInfo);
    const dumbBinsUpdateCheckResults: boolean[] = dumbBinsUpdate.map(BinHelper.verifyDumbBinUpdateInfo);
    
    // If any one element of any one array specified above fails the test, then treat the entire modification request as a 
    // transaction and abort it, by sending the error message indicating the failure of the operation and a list of indices 
    // for each array indicating the documents at those indices being malformed somehow back to the requesting client with the 
    // status code being BAD_REQUEST (400) as it is the client's responsibility to ensure the correctness of the sending data
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

    try {
        // Add the _id field to each of the dumb bin documents that are to be created below
        const dumbBinsCreateWithIdsAdded = dumbBinsCreate.map(
            (dumbBinCreate) => Object.assign(dumbBinCreate, {
                _id: new mongoose.Types.ObjectId()
            })
        );
        // Only perform the update operation as a whole by calling updateBins helper function on the DumbBin 
        // database collection, if there exists at least one dumb bin to be created, or deleted or updated
        if (dumbBinsDelete.length > 0 || dumbBinsCreate.length > 0 || dumbBinsUpdate.length > 0) {
            const dumbBinsUpdateBulkWriteResult = await BinHelper.updateBins(
                dumbBinsDelete as BinDeleteInfo[],
                dumbBinsCreateWithIdsAdded as BinCreateInfo[],
                dumbBinsUpdate as BinUpdateInfo[],
                false
            );
            // Only continue if the bulk update of all input dumb bins succeeds above
            if (!dumbBinsUpdateBulkWriteResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateBulkWriteResult", dumbBinsUpdateBulkWriteResult, "\n");
                throw new Error("Failed to update dumb bins");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateBulkWriteResult", dumbBinsUpdateBulkWriteResult, "\n");
        }

        // Send an array of IDs for the newly created dumb bins in the same order as they are specified in dumbBinsCreate
        // extracted from the request body with the status code being CREATED (201) back to the requesting client
        response.status(HTTP.CREATED).json({
            insertedIds: dumbBinsCreateWithIdsAdded.map(dumbBinCreate => dumbBinCreate._id)
        });

        // Only continue if at least one dumb bin is created, or deleted or updated
        if (dumbBinsDelete.length > 0 || dumbBinsCreate.length > 0 || dumbBinsUpdate.length > 0) {
            // Recompute and update the distances between only a selection of pairs of smart bins, dumb bins, and depots 
            // in the database according to the input information regarding the deleted, created and updated dumb bins so 
            // that the recomputation of the bin distances is limited to a minimum without doing any unnecessary work for 
            // those bins that remain the same in the database
            const binDistancesUpdateResult = await BinDistanceHelper.updateBinDistances(
                request.app.get("GoogleMapsServicesAdapter") as GoogleMapsServicesAdapter,
                dumbBinsDelete,
                dumbBinsCreateWithIdsAdded,
                dumbBinsUpdate,
                false
            );
            // Only continue if the bulk update of the bin distances succeeds above
            if (!binDistancesUpdateResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "binDistancesUpdateResult", binDistancesUpdateResult, "\n");
                throw new Error("Failed to update bins distances");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "binDistancesUpdateResult", binDistancesUpdateResult, "\n");

            // Recompute and update the nearestSmartBin field for each of the created and updated dumb bins in the database 
            const dumbBinsUpdateOnNearestSmartBinsResult = await BinHelper.updateNearestSmartBins(
                dumbBinsCreateWithIdsAdded.concat(dumbBinsUpdate)
            );
            // Only continue if the update of the specified (created and updated) dumb bins succeeds above
            if (!dumbBinsUpdateOnNearestSmartBinsResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateOnNearestSmartBinsResult", dumbBinsUpdateOnNearestSmartBinsResult, "\n");
                throw new Error("Failed to update dumb bins' nearest smart bins");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "dumbBinsUpdateOnNearestSmartBinsResult", dumbBinsUpdateOnNearestSmartBinsResult, "\n");

            // Recompute and update the bin collection schedules
            const binCollectionSchedulesUpdateResult = await BinCollectionScheduleHelper.updateBinCollectionSchedules();
            // Only continue if the update of all bin collection schedules succeeds above
            if (!binCollectionSchedulesUpdateResult) {
                Logger.verboseError(MODIFY_BINS_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
                throw new Error("Failed to update bin collection schedules");
            }
            Logger.verboseLog(MODIFY_BINS_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
        }
    } catch (error) {
        // As any errors that may be encountered in the above section must be after the input data verification, and hence it 
        // must be a server erorr, send an empty response body with the status code being INTERNAL_SERVER_ERROR (500) back to 
        // the client in this case
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(error, "\n");
    }
}
