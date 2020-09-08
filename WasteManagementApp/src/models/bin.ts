import mongoose from "mongoose";

const binSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    serialNumber: {
        type: mongoose.Schema.Types.Number,
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
        min: 10,
        max: 1000,
        required: true,
        default: 240
    },
    threshold: {
        type: mongoose.Schema.Types.Number,
    },
    currentFullness: {
        type: mongoose.Schema.Types.Number,
        validate: function(fullness: Number) {
            return fullness >= 0 && fullness <= (this as any).threshold;
        },
    },
    lastUpdated: {
        type: mongoose.Schema.Types.Date,
        required: true,
        default: Date.now
    },
    nearestSmartBinId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bin"
    }
}, {
    autoIndex: false,
    collection: "Bins"
});

binSchema.index({
    location: "2dsphere"
});

export default mongoose.model("Bin", binSchema);
