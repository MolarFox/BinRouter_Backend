import mongoose from "mongoose";

const binDistanceSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    origin: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "originBinType"
    },
    originBinType: {
        type: mongoose.Schema.Types.String,
        required: true,
        enum: ["SmartBin", "DumbBin"]
    },
    destination: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "destinationBinType"
    },
    destinationBinType: {
        type: mongoose.Schema.Types.String,
        required: true,
        enum: ["SmartBin", "DumbBin"]
    },
    distance: {
        type: mongoose.Schema.Types.Number,
        required: true,
        min: 0
    },
    duration: {
        type: mongoose.Schema.Types.Number,
        required: true,
        min: 0
    }
}, {
    autoIndex: false,
    selectPopulatedPaths: false,
    collection: "BinDistances"
});

export default mongoose.model("BinDistance", binDistanceSchema);
