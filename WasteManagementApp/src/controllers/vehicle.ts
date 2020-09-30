import express from "express";
import FleetVehicle from "../models/fleet-vehicle";
import Depot from "../models/depot";
import * as HTTP from "../constants/http"

export function getFleetVehicles(request: express.Request, response: express.Response) {
    Promise.all([
        Depot.find({}),
        FleetVehicle.find({})
    ])
    .then(([depots, fleetVehicles]) => 
        response.status(HTTP.OK).json({
            depots: depots.map((depot: any) => ({
                _id: depot._id,
                longitude: depot.location.coordinates[0],
                latitude: depot.location.coordinates[1],
                address: depot.address
            })),
            fleetVehicles: fleetVehicles.map((fleetVehicle: any) => ({
                rego: fleetVehicle.rego,
                capacity: fleetVehicle.capacity,
                available: fleetVehicle.available,
                icon: fleetVehicle.icon,
                belongTo: fleetVehicle.belongTo
            }))
        })
    )
    .catch((error) => console.error(error));
}
