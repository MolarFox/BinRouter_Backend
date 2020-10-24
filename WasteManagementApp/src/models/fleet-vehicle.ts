/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definition of a database schema and a model compiled from it for fleet vehicles.
 */

import mongoose from "mongoose";

// Define a mongoose schema for fleet vehicles
const fleetVehicleSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    rego: {
        type: mongoose.Schema.Types.String,
        required: true,
        unique: true
    },
    capacity: {
        type: mongoose.Schema.Types.Number,
        min: 1,
        max: 50000,
        required: true
    },
    available: {
        type: mongoose.Schema.Types.Boolean,
        required: true
    },
    icon: {
        type: mongoose.Schema.Types.Number,
        min: 0,
        max: 11,
        required: true
    },
    homeDepot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Depot"
    }
}, {
    collection: "FleetVehicles"
});

// Compile a mongoose model named "FleetVehicles" on fleetVehicleSchema defined above, which will be used as the 
// main interface to interact with the MongoDB collection named "FleetVehicles"
export default mongoose.model("FleetVehicle", fleetVehicleSchema);
