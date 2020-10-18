import express from "express";
import * as HTTP from "../constants/http"
import Depot from "../models/depot";
import BinCollectionSchedule from "../models/bin-collection-schedule";

export async function getBinCollectionSchedules(request: express.Request, response: express.Response) {
    try {
        const depots = await Depot.find({});
        const binCollectionSchedules = await BinCollectionSchedule.find({});
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
                    directions: route.directions
                })),
                timestamp: binCollectionSchedule.timestamp
            }))
        });
    } catch(error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        console.error(error);
    }
}

export async function getBinCollectionSchedulesTimestamp(request: express.Request, response: express.Response) {
    const timestampDoc = await BinCollectionSchedule.findOne({}, "-_id timestamp") as unknown as { timestamp: Date };
    response.status(HTTP.OK).json(timestampDoc ? timestampDoc : {});
}
