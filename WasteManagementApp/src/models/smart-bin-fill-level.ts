import mongoose from "mongoose";

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
    collection: "SmartBinsFillLevels"
});

smartBinFillLevelSchema.virtual("smartBin", {
    ref: "SmartBin",
    localField: "serialNumber",
    foreignField: "serialNumber",
    justOne: false
});

// If using populated projections, make sure foreignField is included in the projection
// For example
// SmartBinFillLevel.find({}).populate({path: "smartBin", select: "location serialNumber"}).exec(function(err, docs) {});

export default mongoose.model("SmartBinFillLevel", smartBinFillLevelSchema);
