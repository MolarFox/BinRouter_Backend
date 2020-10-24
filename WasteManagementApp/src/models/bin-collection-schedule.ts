/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definition of a database schema and a model compiled from it for bin collection schedules.
 */

import mongoose from "mongoose";

// Define a mongoose schema for bin collection schedules
const binCollectionScheduleSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    routes: [
        {
            _id: false,
            vehicle: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "FleetVehicle",
                required: true
            }, 
            visitingOrder: [
                {
                    _id: false,
                    longitude: {
                        type: mongoose.Schema.Types.Number,
                        required: true
                    },
                    latitude: {
                        type: mongoose.Schema.Types.Number,
                        required: true
                    }
                }
            ]
        }
    ],
    timestamp: {
        type: mongoose.Schema.Types.Date,
        required: true
    }
}, {
    collection: "BinCollectionSchedules"
});

// Compile a mongoose model named "BinCollectionSchedule" on binCollectionScheduleSchema defined above, which will be used 
// as the main interface to interact with the MongoDB collection named "BinCollectionSchedule"
export default mongoose.model("BinCollectionSchedule", binCollectionScheduleSchema);
