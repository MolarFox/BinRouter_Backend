/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definition of a database schema and a model compiled from it for smart bins.
 */

import mongoose from "mongoose";

// Define a mongoose schema for smart bins
const smartBinSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    serialNumber: {
        type: mongoose.Schema.Types.Number,
        required: true,
        unique: true
    },
    location: {
        type: {
            type: mongoose.Schema.Types.String,
            enum: ["Point"],
            required: true
        },
        coordinates: {
            type: [mongoose.Schema.Types.Number],
            validate: function(lnglat: number[]) {
                if (lnglat.length == 2) {
                    const longitude = lnglat[0];
                    const latitude = lnglat[1];
                    return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
                }
                return false;
            },
            required: true
        }
    },
    address: {
        type: mongoose.Schema.Types.String,
        minlength: 1,
        required: true
    },
    capacity: {
        type: mongoose.Schema.Types.Number,
        min: 1,
        max: 1000,
        required: true
    },
    threshold: {
        type: mongoose.Schema.Types.Number,
        min: 0,
        required: true
    },
    currentFullness: {
        type: mongoose.Schema.Types.Number,
        min: 0
    },
    lastUpdated: {
        type: mongoose.Schema.Types.Date,
        required: true
    }
}, {
    collection: "SmartBins"
});

// Create a 2dsphere index on the location field of this schema to allow geospatial queries such as $near to be 
// performed on this field
smartBinSchema.index({
    location: "2dsphere"
});

// Compile a mongoose model named "SmartBin" on smartBinSchema defined above, which will be used as the main interface 
// to interact with the MongoDB collection named "SmartBins"
export default mongoose.model("SmartBin", smartBinSchema);
