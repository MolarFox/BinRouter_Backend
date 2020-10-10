import express from "express";
import BinCollectionSchedule from "../models/bin-collection-schedule";
import Depot from "../models/depot";
import * as HTTP from "../constants/http"

export function getBinCollectionSchedules(request: express.Request, response: express.Response) {
    Promise
        .all([
            Depot.find({}),
            BinCollectionSchedule.find({})
        ])
        .then(([depots, binCollectionSchedules]) => 
            response.status(HTTP.OK).json({
                depots: depots.map((depot: any) => ({
                    _id: depot._id,
                    longitude: depot.location.coordinates[0],
                    latitude: depot.location.coordinates[1],
                    address: depot.address
                })),
                binCollectionSchedules: binCollectionSchedules.map((binCollectionSchedule: any) => ({
                    searchStrategy: binCollectionSchedule.searchStrategy,
                    routes: (binCollectionSchedule.routes as Array<any>).map((route) => ({
                        vehicle: route.vehicle,
                        directions: route.directions
                    }))
                }))
            })
        )
        .catch((error) => console.error(error));
}
