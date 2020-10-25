/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes all the bin collection schedule-related HTTP request handler functions. It provides 
 * the functionality of handling a GET request to retrieve all the bin collection schedules currently stored in the 
 * database, and handling a GET reuquest to retrieve the timestamp of the bin collection schedules currently stored 
 * in the database.
 */

import express from "express";
import * as HTTP from "../constants/http"
import { GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, GET_BIN_COLLECTION_SCHEDULES_TIMESTAMP_LOG_TAG } from "../constants/log-tag";
import BinCollectionSchedule from "../models/bin-collection-schedule";
import Depot from "../models/depot";
import { Logger } from "../utils/logger";

/**
 * Handle an incoming HTTP GET request to retrieve all the bin collection schedules currently stored in the database
 * 
 * @async
 * @param {express.Request} request an incoming HTTP GET request object containing the parsed request body
 * @param {express.Response} response an outgoing response to the incoming HTTP GET request containing the information to be sent back
 * 
 * @returns {void}
 */
export async function getBinCollectionSchedules(request: express.Request, response: express.Response) {
    try {
        // depots stores all the depots (only 1 though) currently stored in the database
        const depots = await Depot.find({});
        Logger.verboseLog(GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, "depots", depots, "\n");

        // binCollectionSchedules stores all the bin collection schedules currently stored in the database
        const binCollectionSchedules = await BinCollectionSchedule.find({});
        Logger.verboseLog(GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, "binCollectionSchedules", binCollectionSchedules, "\n");

        // Format both depots and binCollectionSchedules into appropriate forms and then send them as the response body 
        // with the status code being OK (200) back to the requesting client
        response.status(HTTP.OK).json({
            depots: depots.map((depot: any) => ({
                _id: depot._id,
                longitude: depot.location.coordinates[0],
                latitude: depot.location.coordinates[1],
                address: depot.address
            })),
            binCollectionSchedules: binCollectionSchedules.map((binCollectionSchedule: any) => ({
                routes: (binCollectionSchedule.routes as Array<any>).map((route) => ({
                    vehicle: route.vehicle,
                    visitingOrder: route.visitingOrder
                })),
                timestamp: binCollectionSchedule.timestamp
            }))
        });
    } catch (error) {
        // As any errors that may be encountered in the above section must be a server erorr, send an empty response body 
        // with the status code being INTERNAL_SERVER_ERROR (500) back to the client in this case
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, error, "\n");
    }
}

/**
 * Handle an incoming HTTP GET request to retrieve the timestamp of the bin collection schedules currently stored in the database
 * 
 * @async
 * @param {express.Request} request an incoming HTTP GET request object containing the parsed request body
 * @param {express.Response} response an outgoing response to the incoming HTTP GET request containing the information to be sent back
 * 
 * @returns {void}
 */
export async function getBinCollectionSchedulesTimestamp(request: express.Request, response: express.Response) {
    try {
        // timestampDoc stores the timestamp of the bin collection schedules currently stored in the database
        const timestampDoc = await BinCollectionSchedule.findOne({}, "-_id timestamp") as unknown as { timestamp: Date };
        // Send timestampDoc as the response body if it is defined and not null, otherwise send an empty response body 
        // with the status code being OK (200) back to the requesting client
        response.status(HTTP.OK).json(timestampDoc ? timestampDoc : {});
    } catch (error) {
        // As any errors that may be encountered in the above section must be a server erorr, send an empty response body 
        // with the status code being INTERNAL_SERVER_ERROR (500) back to the client in this case
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_BIN_COLLECTION_SCHEDULES_TIMESTAMP_LOG_TAG, error, "\n");
    }
}
