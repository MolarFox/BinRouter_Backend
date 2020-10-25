/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes all the fleet vehicle-related HTTP request handler functions. It provides the 
 * functionality of handling a GET request to retrieve all the fleet vehicles currently stored in the database, 
 * and handling a PUT reuquest to modify the fleet vehicles (i.e., including create a new one, delete an existing 
 * one, and update an existing one) according to the information specified in the request body.
 */

import express from "express";
import mongoose from "mongoose";
import * as HTTP from "../constants/http"
import { GET_FLEET_VEHICLES, MODIFY_FLEET_VEHICLES } from "../constants/log-tag";
import Depot from "../models/depot";
import FleetVehicle from "../models/fleet-vehicle";
import { FleetVehicleCreateInfo, FleetVehicleDeleteInfo, FleetVehicleUpdateInfo } from "../utils/type-information";
import { BinCollectionScheduleHelper } from "../utils/bin-collection-schedule-helper";
import { FleetVehicleHelper } from "../utils/fleet-vehicle-helper";
import { Logger } from "../utils/logger";

/**
 * Handle an incoming HTTP GET request to retrieve all the fleet vehicles currently stored in the database
 * 
 * @async
 * @param {express.Request} request an incoming HTTP GET request object containing the parsed request body
 * @param {express.Response} response an outgoing response to the incoming HTTP GET request containing the information to be sent back
 * 
 * @returns {void}
 */
export async function getFleetVehicles(request: express.Request, response: express.Response) {
    try {
        // depots stores all the depots (only 1 though) currently stored in the database
        const depots = await Depot.find({});
        Logger.verboseLog(GET_FLEET_VEHICLES, "depots", depots, "\n");

        // fleetVehicles stores all the fleet vehicles currently stored in the database
        const fleetVehicles = await FleetVehicle.find({});
        Logger.verboseLog(GET_FLEET_VEHICLES, "fleetVehicles", fleetVehicles, "\n");

        // Format both depots and fleetVehicles into appropriate forms and then send them as the response body 
        // with the status code being OK (200) back to the requesting client
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
        // As any errors that may be encountered in the above section must be a server erorr, send an empty response body 
        // with the status code being INTERNAL_SERVER_ERROR (500) back to the client in this case
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(GET_FLEET_VEHICLES, error, "\n");
    }
}

/**
 * Handle an incoming HTTP PUT request to modify the fleet vehicles in the database according to the information specified 
 * in the request body
 * 
 * @async
 * @param {express.Request} request an incoming HTTP PUT request object containing the parsed request body
 * @param {express.Response} response an outgoing response to the incoming HTTP PUT request containing the information to be sent back
 * 
 * @returns {void}
 */
export async function modifyFleetVehicles(request: express.Request, response: express.Response) {
    // fleetVehiclesDelete should store an array of strings each representing the ID of an existing fleet vehicle that is to be deleted later
    const fleetVehiclesDelete: any[] = Array.isArray(request.body.fleetVehiclesDelete) ? request.body.fleetVehiclesDelete : [];
    // fleetVehiclesCreate should store an array of objects each representing a new fleet vehicle that is to be created later
    const fleetVehiclesCreate: any[] = Array.isArray(request.body.fleetVehiclesCreate) ? request.body.fleetVehiclesCreate : [];
    // fleetVehiclesCreate should store an array of objects each representing an existing fleet vehicle that is to be updated accordingly later
    const fleetVehiclesUpdate: any[] = Array.isArray(request.body.fleetVehiclesUpdate) ? request.body.fleetVehiclesUpdate : [];

    // Verify whether the content of each array contained in the request body has the valid format which can be used in forming 
    // the database bulk operations below without errors
    const fleetVehiclesDeleteCheckResults: boolean[] = fleetVehiclesDelete.map(FleetVehicleHelper.verifyFleetVehicleDeleteInfo);
    const fleetVehiclesCreateCheckResults: boolean[] = fleetVehiclesCreate.map(FleetVehicleHelper.verifyFleetVehicleCreateInfo);
    const fleetVehiclesUpdateCheckResults: boolean[] = fleetVehiclesUpdate.map(FleetVehicleHelper.verifyFleetVehicleUpdateInfo);
    
    // If any one element of any one array specified above fails the test, then treat the entire modification request as a 
    // transaction and abort it, by sending the error message indicating the failure of the operation and a list of indices 
    // for each array indicating the documents at those indices being malformed somehow back to the requesting client with the 
    // status code being BAD_REQUEST (400) as it is the client's responsibility to ensure the correctness of the sending data
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
        // Construct the documents for delete-related operations to be used in a bulk write operation
        const fleetVehiclesDeleteBulkOperations = 
            (fleetVehiclesDelete as FleetVehicleDeleteInfo[]).map((_id) => ({
                deleteOne: {
                    filter: { 
                        _id: new mongoose.Types.ObjectId(_id)
                    }
                }
            }));
        // Construct the documents for create-related operations to be used in a bulk write operation
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
        // Construct the documents for update-related operations to be used in a bulk write operation
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
        
        // Only perform the bulk write operation constructed through the concatenation of fleetVehiclesDeleteBulkOperations, 
        // fleetVehiclesCreateBulkOperations, and fleetVehiclesUpdateBulkOperations on the FleetVehicles database collection, 
        // if there exists at least one delete or create or update operation
        if (fleetVehiclesDelete.length > 0 || fleetVehiclesCreate.length > 0 || fleetVehiclesUpdate.length > 0) {
            const fleetVehiclesUpdatebulkWriteResult = await FleetVehicle.bulkWrite(
                (fleetVehiclesDeleteBulkOperations as any[])
                    .concat(fleetVehiclesCreateBulkOperations)
                    .concat(fleetVehiclesUpdateBulkOperations)
            );
            // Only continue if the bulk update of all input fleet vehicles succeeds above
            if (fleetVehiclesUpdatebulkWriteResult.result?.ok !== 1 ||  
                fleetVehiclesUpdatebulkWriteResult.result?.writeErrors.length !== 0) {
                Logger.verboseError(MODIFY_FLEET_VEHICLES, "fleetVehiclesUpdatebulkWriteResult", fleetVehiclesUpdatebulkWriteResult, "\n");
                throw new Error("Failed to update fleet vehicles");
            }
            Logger.verboseLog(MODIFY_FLEET_VEHICLES, "fleetVehiclesUpdatebulkWriteResult", fleetVehiclesUpdatebulkWriteResult, "\n");    
        }

        // Send an array of IDs for the newly created fleet vehicles in the same order as they are specified in 
        // fleetVehiclesCreate extracted from the request body with the status code being CREATED (201) back to 
        // the requesting client
        response.status(HTTP.CREATED).json({
            insertedIds: fleetVehiclesCreateBulkOperations.map(doc => doc.insertOne.document._id)
        });

        // Only perform a recomputation of the bin collection schedules if at least one fleet vehicle is created, or deleted
        // or updated, as their availabilities could invalidate the existing bin collection schedules stored in the database
        if (fleetVehiclesDelete.length > 0 || fleetVehiclesCreate.length > 0 || fleetVehiclesUpdate.length > 0) {
            // Recompute and update the bin collection schedules
            const binCollectionSchedulesUpdateResult = await BinCollectionScheduleHelper.updateBinCollectionSchedules();
            // Only continue if the update of all bin collection schedules succeeds above
            if (!binCollectionSchedulesUpdateResult) {
                Logger.verboseError(MODIFY_FLEET_VEHICLES, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
                throw new Error("Failed to update bin collection schedules");
            }
            Logger.verboseLog(MODIFY_FLEET_VEHICLES, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
        }
    } catch (error) {
        // As any errors that may be encountered in the above section must be after the input data verification, and hence it 
        // must be a server erorr, send an empty response body with the status code being INTERNAL_SERVER_ERROR (500) back to 
        // the client in this case
        response.status(HTTP.INTERNAL_SERVER_ERROR).send();
        Logger.error(error, "\n");
    }
}
