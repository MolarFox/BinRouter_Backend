/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definition of a database schema and a model compiled from it for depots.
 */

import mongoose from "mongoose";

// Define a mongoose schema for depots
const depotSchema = new mongoose.Schema({
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
}, {
    collection: "Depots"
});

// Create a 2dsphere index on the location field of this schema to allow geospatial queries such as $near to be 
// performed on this field
depotSchema.index({
    location: "2dsphere"
});

// Compile a mongoose model named "Depot" on depotSchema defined above, which will be used as the 
// main interface to interact with the MongoDB collection named "Depots"
export default mongoose.model("Depot", depotSchema);
