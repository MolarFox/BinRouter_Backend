import mongoose from "mongoose";

const fleetVehicle = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    rego: {
        type: mongoose.Schema.Types.String,
        required: true,
        unique: true
    },
    capacity: {
        type: mongoose.Schema.Types.Number,
        min: 10,
        max: 50000,
        required: true
    },
    available: {
        type: mongoose.Schema.Types.Boolean,
        required: true
    },
    icon: {
        type: mongoose.Schema.Types.Number
    },
}, {
    autoIndex: false,
    collection: "FleetVehicle"
});

export default mongoose.model("FleetVehicle", fleetVehicle);
