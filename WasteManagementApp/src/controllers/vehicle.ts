import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import Depot from "../models/depot";
import FleetVehicle from "../models/fleet-vehicle";
import BinCollectionSchedule from "../models/bin-collection-schedule";
import { FleetVehicleCreateInfo, FleetVehicleDeleteInfo, FleetVehicleUpdateInfo, mongooseInsertWriteOpResult } from "../utils/type-information";
import { BinCollectionScheduleHelper } from "../utils/bin-collection-schedule-helper";
import { GoogleMapsServicesAdapter } from "../utils/google-maps-services-adapter";

export async function getFleetVehicles(request: express.Request, response: express.Response) {
    try {
        const depots = await Depot.find({});
        const fleetVehicles = await FleetVehicle.find({});
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
        });
    } catch(error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        console.error(error);
    }
}

export async function modifyFleetVehicles(request: express.Request, response: express.Response) {
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

    try {
        const fleetVehiclesDeleteCreateUpdatebulkWriteResult = await FleetVehicle.bulkWrite(
            (fleetVehiclesDeleteBulkOperations as any[])
                .concat(fleetVehiclesCreateBulkOperations)
                .concat(fleetVehiclesUpdateBulkOperations)
        );
        if (fleetVehiclesDeleteCreateUpdatebulkWriteResult.result && 
            fleetVehiclesDeleteCreateUpdatebulkWriteResult.result.ok === 1 && 
            fleetVehiclesDeleteCreateUpdatebulkWriteResult.result.writeErrors.length === 0) {
            response.status(HTTP.CREATED).send(fleetVehiclesDeleteCreateUpdatebulkWriteResult.insertedIds);
        } else {
            response.status(HTTP.BAD_REQUEST).send(fleetVehiclesDeleteCreateUpdatebulkWriteResult.result.writeErrors);
            console.error(fleetVehiclesDeleteCreateUpdatebulkWriteResult);
        }
    } catch(error) {
        response.status(HTTP.BAD_REQUEST).send(error.writeErrors);
        console.error(error);
    }
    
    if (fleetVehiclesDelete.length > 0 || fleetVehiclesCreate.length > 0 || fleetVehiclesUpdate.length > 0) {
        try {
            // Recompute the route by calling the recomputation routine
            const binCollectionSchedules = await BinCollectionScheduleHelper.createAllPossibleBinCollectionSchedules(
                request.app.get("GoogleMapsServicesAdapter") as GoogleMapsServicesAdapter
            );
            const binCollectionSchedulesInsertWriteResult = await BinCollectionSchedule.insertMany(
                binCollectionSchedules.map(binCollectionSchedule => 
                    Object.assign(binCollectionSchedule, {
                        _id: new mongoose.Types.ObjectId()
                    })
                ), {
                    rawResult: true
                }
            ) as unknown as mongooseInsertWriteOpResult;
            if (binCollectionSchedulesInsertWriteResult.result?.ok !== 1) {
                console.error(binCollectionSchedulesInsertWriteResult);
            }
        } catch(error) {
            console.error(error);
        }
    }
}
