import mongoose from "mongoose";

const binCollectionScheduleSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    routes: [
        {
            _id: false,
            vehicle: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "FleetVehicle",
                required: true
            }, 
            visitingOrder: [
                {
                    _id: false,
                    longitude: {
                        type: mongoose.Schema.Types.Number,
                        required: true
                    },
                    latitude: {
                        type: mongoose.Schema.Types.Number,
                        required: true
                    }
                }
            ]
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
