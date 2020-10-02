import express from "express";
import BinCollectionRoute from "../models/bin-collection-route";
import Depot from "../models/depot";
import * as HTTP from "../constants/http"

export function getBinCollectionRoutes(request: express.Request, response: express.Response) {
    Promise
        .all([
            Depot.find({}),
            BinCollectionRoute.find({})
        ])
        .then(([depots, binCollectionRoutes]) => 
            response.status(HTTP.OK).json({
                depots: depots.map((depot: any) => ({
                    _id: depot._id,
                    longitude: depot.location.coordinates[0],
                    latitude: depot.location.coordinates[1],
                    address: depot.address
                })),
                binCollectionRoutes: binCollectionRoutes.map((binCollectionRoute: any) => ({
                    searchStrategy: binCollectionRoute.searchStrategy,
                    routes: (binCollectionRoute.routes as Array<any>).map((route) => ({
                        vehicle: route.vehicle,
                        directions: route.directions
                    }))
                }))
            })
        )
        .catch((error) => console.error(error));
}
