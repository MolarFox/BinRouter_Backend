import mongoose from "mongoose";

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
            validate: function(lnglat: Number[]) {
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

smartBinSchema.index({
    location: "2dsphere"
});

export default mongoose.model("SmartBin", smartBinSchema);
