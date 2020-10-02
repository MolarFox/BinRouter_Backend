import mongoose from "mongoose";

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

export default mongoose.model("BinDistance", binDistanceSchema);
