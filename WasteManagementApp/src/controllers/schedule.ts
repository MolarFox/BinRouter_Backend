import express from "express";
import * as HTTP from "../constants/http"
import { GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, GET_BIN_COLLECTION_SCHEDULES_TIMESTAMP_LOG_TAG } from "../constants/log-tag";
import Depot from "../models/depot";
import BinCollectionSchedule from "../models/bin-collection-schedule";
import { Logger } from "../utils/logger";

export async function getBinCollectionSchedules(request: express.Request, response: express.Response) {
    try {
        const depots = await Depot.find({});
        Logger.verboseLog(GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, "depots", depots, "\n");

        const binCollectionSchedules = await BinCollectionSchedule.find({});
        console.log(binCollectionSchedules);
        Logger.verboseLog(GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, "binCollectionSchedules", binCollectionSchedules, "\n");

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
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_BIN_COLLECTION_SCHEDULES_LOG_TAG, error, "\n");
    }
}

export async function getBinCollectionSchedulesTimestamp(request: express.Request, response: express.Response) {
    try {
        const timestampDoc = await BinCollectionSchedule.findOne({}, "-_id timestamp") as unknown as { timestamp: Date };
        response.status(HTTP.OK).json(timestampDoc ? timestampDoc : {});
    } catch (error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_BIN_COLLECTION_SCHEDULES_TIMESTAMP_LOG_TAG, error, "\n");
    }
}
