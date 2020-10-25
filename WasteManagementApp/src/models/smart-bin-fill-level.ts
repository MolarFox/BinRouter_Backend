/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definition of a database schema and a model compiled from it for smart bin fill levels.
 * NOTE: This database collection is mainly used for tracking the history, and a prediction of smart bin future fill levels 
 * may be incorporated as the potential future work for implementing the precomputation of the bin collection schedules.
 */

import mongoose from "mongoose";

// Define a mongoose schema for smart bin fill levels
const smartBinFillLevelSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    serialNumber: {
        type: mongoose.Schema.Types.Number,
        required: true,
    },
    fullness: {
        type: mongoose.Schema.Types.Number,
        min: 0,
        required: true
    },
    timestamp: {
        type: mongoose.Schema.Types.Date,
        required: true
    },
}, {
    collection: "SmartBinFillLevels"
});

// Create a foreign key on serialNumber to link each document in this collection back to a smart bin document in SmartBins collection
smartBinFillLevelSchema.virtual("smartBin", {
    ref: "SmartBin",
    localField: "serialNumber",
    foreignField: "serialNumber",
    justOne: false
});

// If using populated projections, make sure foreignField is included in the projection
// For example
// SmartBinFillLevel.find({}).populate({path: "smartBin", select: "location serialNumber"}).exec(function(err, docs) {});

// Compile a mongoose model named "SmartBinFillLevel" on smartBinFillLevelSchema defined above, which will be used as 
// the main interface to interact with the MongoDB collection named "SmartBinsFillLevels"
export default mongoose.model("SmartBinFillLevel", smartBinFillLevelSchema);
