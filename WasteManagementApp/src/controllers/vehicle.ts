import express from "express";
import mongoose from "mongoose";
import FleetVehicle from "../models/fleet-vehicle";
import Depot from "../models/depot";
import * as HTTP from "../constants/http"
import { FleetVehicleCreateInfo, FleetVehicleDeleteInfo, FleetVehicleUpdateInfo } from "../utils/type-information";

export function getFleetVehicles(request: express.Request, response: express.Response) {
    Promise
        .all([
            Depot.find({}),
            FleetVehicle.find({})
        ])
        .then(([depots, fleetVehicles]) => {
            response.status(HTTP.OK).json({
                depots: depots.map((depot: any) => ({
                    _id: depot._id,
                    longitude: depot.location.coordinates[0],
                    latitude: depot.location.coordinates[1],
                    address: depot.address
                })),
                fleetVehicles: fleetVehicles.map((fleetVehicle: any) => ({
                    _id: fleetVehicle._id,
                    rego: fleetVehicle.rego,
                    capacity: fleetVehicle.capacity,
                    available: fleetVehicle.available,
                    icon: fleetVehicle.icon,
                    belongTo: fleetVehicle.belongTo
                }))
            })
        })
        .catch((error) => {
            console.error(error);
            response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        });
}

export function modifyFleetVehicles(request: express.Request, response: express.Response) {
    const fleetVehiclesDelete: FleetVehicleDeleteInfo[] = Array.isArray(request.body.fleetVehiclesDelete) ? request.body.fleetVehiclesDelete : [];
    const fleetVehiclesCreate: FleetVehicleCreateInfo[] = Array.isArray(request.body.fleetVehiclesCreate) ? request.body.fleetVehiclesCreate : [];
    const fleetVehiclesUpdate: FleetVehicleUpdateInfo[] = Array.isArray(request.body.fleetVehiclesUpdate) ? request.body.fleetVehiclesUpdate : [];

    const fleetVehiclesDeleteBulkOperations = fleetVehiclesDelete.map((_id) => ({
        deleteOne: {
            filter: { 
                _id: _id
            }
        }
    }));
    const fleetVehiclesCreateBulkOperations = fleetVehiclesCreate.map((fleetVehicle) => ({
        insertOne: {
            document: {
                _id: new mongoose.Types.ObjectId(),
                rego: fleetVehicle.rego,
                capacity: fleetVehicle.capacity,
                available: fleetVehicle.available,
                icon: fleetVehicle.icon,
                belongTo: fleetVehicle.belongTo ? fleetVehicle.belongTo : undefined
            }
        }
    }));
    const fleetVehiclesUpdateBulkOperations = fleetVehiclesUpdate.map((fleetVehicle) => ({
        updateOne: {
            filter: {
                _id: fleetVehicle._id,
            },
            update: {
                rego: fleetVehicle.rego,
                capacity: fleetVehicle.capacity, 
                available: fleetVehicle.available,
                icon: fleetVehicle.icon,
                belongTo: fleetVehicle.belongTo ? fleetVehicle.belongTo : undefined
            }
        }
    }));

    FleetVehicle
        .bulkWrite((fleetVehiclesDeleteBulkOperations as any[]).concat(fleetVehiclesCreateBulkOperations).concat(fleetVehiclesUpdateBulkOperations))
        .then((bulkWriteOperationResult) => {
            if (bulkWriteOperationResult.result && bulkWriteOperationResult.result.ok === 1 && bulkWriteOperationResult.result.writeErrors.length === 0) {
                response.status(HTTP.CREATED).send(bulkWriteOperationResult.insertedIds);
            } else {
                response.status(HTTP.BAD_REQUEST).send(bulkWriteOperationResult.result.writeErrors);
                return Promise.reject(bulkWriteOperationResult.result);
            }
        })
        .catch((error) => {
            console.error(error);
            response.status(HTTP.BAD_REQUEST).send(error.writeErrors);
        });
    
    if (fleetVehiclesDelete.length > 0 || fleetVehiclesCreate.length > 0 || fleetVehiclesUpdate.length > 0) {
        // Recompute the route by calling the recomputation routine
    }
}
