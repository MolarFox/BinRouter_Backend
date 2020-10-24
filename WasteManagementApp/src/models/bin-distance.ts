/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definition of a database schema and a model compiled from it for bin distances.
 */

import mongoose from "mongoose";

// Define a mongoose schema for bin distances
const binDistanceSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    origin: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "originType"
    },
    originType: {
        type: mongoose.Schema.Types.String,
        required: true,
        enum: ["Depot", "SmartBin", "DumbBin"]
    },
    destination: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "destinationType"
    },
    destinationType: {
        type: mongoose.Schema.Types.String,
        required: true,
        enum: ["Depot", "SmartBin", "DumbBin"]
    },
    distance: {
        type: mongoose.Schema.Types.Number,
        required: true,
    },
    duration: {
        type: mongoose.Schema.Types.Number,
        required: true,
    }
}, {
    collection: "BinDistances"
});

// Compile a mongoose model named "BinDistance" on binDistanceSchema defined above, which will be used as the 
// main interface to interact with the MongoDB collection named "BinDistances"
export default mongoose.model("BinDistance", binDistanceSchema);
