import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import { GET_FLEET_VEHICLES, MODIFY_FLEET_VEHICLES } from "../constants/log-tag";
import Depot from "../models/depot";
import FleetVehicle from "../models/fleet-vehicle";
import { FleetVehicleCreateInfo, FleetVehicleDeleteInfo, FleetVehicleUpdateInfo, mongooseInsertWriteOpResult } from "../utils/type-information";
import { BinCollectionScheduleHelper } from "../utils/bin-collection-schedule-helper";
import { GoogleMapsServicesAdapter } from "../utils/google-maps-services-adapter";
import { Logger } from "../utils/logger";
import { FleetVehicleHelper } from "../utils/fleet_vehicle_helper";

export async function getFleetVehicles(request: express.Request, response: express.Response) {
    try {
        const depots = await Depot.find({});
        Logger.verboseLog(GET_FLEET_VEHICLES, "depots", depots, "\n");

        const fleetVehicles = await FleetVehicle.find({});
        Logger.verboseLog(GET_FLEET_VEHICLES, "fleetVehicles", fleetVehicles, "\n");

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
                homeDepot: fleetVehicle.homeDepot
            }))
        });
    } catch (error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_FLEET_VEHICLES, error, "\n");
    }
}

export async function modifyFleetVehicles(request: express.Request, response: express.Response) {
    const fleetVehiclesDelete: any[] = Array.isArray(request.body.fleetVehiclesDelete) ? request.body.fleetVehiclesDelete : [];
    const fleetVehiclesCreate: any[] = Array.isArray(request.body.fleetVehiclesCreate) ? request.body.fleetVehiclesCreate : [];
    const fleetVehiclesUpdate: any[] = Array.isArray(request.body.fleetVehiclesUpdate) ? request.body.fleetVehiclesUpdate : [];

    const fleetVehiclesDeleteCheckResults: boolean[] = fleetVehiclesDelete.map(FleetVehicleHelper.verifyFleetVehicleDeleteInfo);
    const fleetVehiclesCreateCheckResults: boolean[] = fleetVehiclesCreate.map(FleetVehicleHelper.verifyFleetVehicleCreateInfo);
    const fleetVehiclesUpdateCheckResults: boolean[] = fleetVehiclesUpdate.map(FleetVehicleHelper.verifyFleetVehicleUpdateInfo);
    
    if (!fleetVehiclesDeleteCheckResults.every(result => result) || 
        !fleetVehiclesCreateCheckResults.every(result => result) || 
        !fleetVehiclesUpdateCheckResults.every(result => result)) {
        response.status(HTTP.BAD_REQUEST).json({
            message: "Malformed content is detected in the three arrays contained in the request body",
            fleetVehiclesDeleteMalformedContentIndexes: fleetVehiclesDeleteCheckResults
                                                            .map((isMatched, index) => !isMatched ? index : undefined)
                                                            .filter(index => index !== undefined),
            fleetVehiclesCreateMalformedContentIndexes: fleetVehiclesCreateCheckResults
                                                            .map((isMatched, index) => !isMatched ? index : undefined)
                                                            .filter(index => index !== undefined),
            fleetVehiclesUpdateMalformedContentIndexes: fleetVehiclesUpdateCheckResults
                                                            .map((isMatched, index) => !isMatched ? index : undefined)
                                                            .filter(index => index !== undefined)
        });
        return;
    }

    try {
        const fleetVehiclesDeleteBulkOperations = 
            (fleetVehiclesDelete as FleetVehicleDeleteInfo[]).map((_id) => ({
                deleteOne: {
                    filter: { 
                        _id: new mongoose.Types.ObjectId(_id)
                    }
                }
            }));
        const fleetVehiclesCreateBulkOperations = 
            (fleetVehiclesCreate as FleetVehicleCreateInfo[]).map((fleetVehicle) => ({
                insertOne: {
                    document: {
                        _id: new mongoose.Types.ObjectId(),
                        rego: fleetVehicle.rego,
                        capacity: fleetVehicle.capacity,
                        available: fleetVehicle.available,
                        icon: fleetVehicle.icon,
                        homeDepot: fleetVehicle.homeDepot ? fleetVehicle.homeDepot : undefined
                    }
                }
            }));
        const fleetVehiclesUpdateBulkOperations = 
            (fleetVehiclesUpdate as FleetVehicleUpdateInfo[]).map((fleetVehicle) => ({
                updateOne: {
                    filter: {
                        _id: new mongoose.Types.ObjectId(fleetVehicle._id),
                    },
                    update: {
                        rego: fleetVehicle.rego,
                        capacity: fleetVehicle.capacity, 
                        available: fleetVehicle.available, 
                        icon: fleetVehicle.icon, 
                        homeDepot: fleetVehicle.homeDepot ? fleetVehicle.homeDepot : undefined
                    }
                }
            }));
        
        if (fleetVehiclesDelete.length > 0 || fleetVehiclesCreate.length > 0 || fleetVehiclesUpdate.length > 0) {
            const fleetVehiclesUpdatebulkWriteResult = await FleetVehicle.bulkWrite(
                (fleetVehiclesDeleteBulkOperations as any[])
                    .concat(fleetVehiclesCreateBulkOperations)
                    .concat(fleetVehiclesUpdateBulkOperations)
            );
            if (fleetVehiclesUpdatebulkWriteResult.result?.ok !== 1 ||  
                fleetVehiclesUpdatebulkWriteResult.result?.writeErrors.length !== 0) {
                Logger.verboseError(MODIFY_FLEET_VEHICLES, "fleetVehiclesUpdatebulkWriteResult", fleetVehiclesUpdatebulkWriteResult, "\n");
                throw new Error("Failed to update fleet vehicles");
            }
            Logger.verboseLog(MODIFY_FLEET_VEHICLES, "fleetVehiclesUpdatebulkWriteResult", fleetVehiclesUpdatebulkWriteResult, "\n");    
        }

        response.status(HTTP.CREATED).json({
            insertedIds: fleetVehiclesCreateBulkOperations.map(doc => doc.insertOne.document._id)
        });

        if (fleetVehiclesDelete.length > 0 || fleetVehiclesCreate.length > 0 || fleetVehiclesUpdate.length > 0) {
            // Recompute the route by calling the recomputation routine
            const binCollectionSchedulesUpdateResult = await BinCollectionScheduleHelper.updateBinCollectionSchedules(
                request.app.get("GoogleMapsServicesAdapter") as GoogleMapsServicesAdapter
            );
            if (!binCollectionSchedulesUpdateResult) {
                Logger.verboseError(MODIFY_FLEET_VEHICLES, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
                throw new Error("Failed to update bin collection schedules");
            }
            Logger.verboseLog(MODIFY_FLEET_VEHICLES, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
        }
    } catch (error) {
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(error, "\n");
    }
}
