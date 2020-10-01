import express from "express";
import * as bins from "./controllers/bin";
import * as vehicles from "./controllers/vehicle";
import * as routes from "./controllers/route";

const router = express.Router();

// router.get("/", function(request, response) {
//     console.dir(request.body);
//     response.send("Hello World!");
// });

// Heatmap-related endpoints

// Bins-related endpoints
router.get("/bins", bins.getBins);
router.put("/bins", bins.modifyBins);

// Vehicles-related endpoints
router.get("/vehicles", vehicles.getFleetVehicles);
router.put("/vehicles", vehicles.modifyFleetVehicles);

// Routes-related endpoints
router.get("/routes", routes.getBinCollectionRoutes);

export default router;
