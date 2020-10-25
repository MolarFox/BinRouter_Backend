/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definition of a database schema and a model compiled from it for dumb bins (non-smart bins).
 */

import mongoose from "mongoose";

// Define a mongoose schema for dumb bins
const dumbBinSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
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
    nearestSmartBin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SmartBin"
    }
}, {
    collection: "DumbBins"
});

// Create a 2dsphere index on the location field of this schema to allow geospatial queries such as $near to be 
// performed on this field
dumbBinSchema.index({
    location: "2dsphere"
});

// Compile a mongoose model named "DumbBin" on dumbBinSchema defined above, which will be used as the 
// main interface to interact with the MongoDB collection named "DumbBins"
export default mongoose.model("DumbBin", dumbBinSchema);
