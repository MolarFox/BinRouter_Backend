import mongoose from "mongoose";

const smartBinFillLevelSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    serialNumber: {
        type: mongoose.Schema.Types.Number,
        required: true,
        ref: "Bin"
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
    autoIndex: false,
    collection: "SmartBinsFillLevels"
});

export default mongoose.model("SmartBinFillLevel", smartBinFillLevelSchema);
