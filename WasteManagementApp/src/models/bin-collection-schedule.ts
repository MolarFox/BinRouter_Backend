import mongoose from "mongoose";

const binCollectionScheduleSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    routes: [
        {
            vehicle: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "FleetVehicle",
                required: true
            }, 
            directions: {
                type: [mongoose.Schema.Types.Mixed],
                required: true
            }
        }
    ],
    timestamp: {
        type: mongoose.Schema.Types.Date,
        required: true
    }
}, {
    collection: "BinCollectionSchedules"
});

export default mongoose.model("BinCollectionSchedule", binCollectionScheduleSchema);
