import mongoose from "mongoose";

const binCollectionRouteSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    searchStrategy: {
        type: mongoose.Schema.Types.String,
        required: true,
        enum: ["AUTOMATIC", "GREEDY_DESCENT", "GUIDED_LOCAL_SEARCH", "SIMULATED_ANNEALING", "TABU_SEARCH", "OBJECTIVE_TABU_SEARCH"]
    },
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
    ]
}, {
    collection: "BinCollectionRoutes"
});

export default mongoose.model("BinCollectionRoute", binCollectionRouteSchema);
