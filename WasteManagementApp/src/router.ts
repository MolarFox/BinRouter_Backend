import express from "express";
import * as bins from "./controllers/bin";
import * as vehicles from "./controllers/vehicle";
import * as schedules from "./controllers/schedule";

const router = express.Router();

// router.get("/", function(request, response) {
//     console.log(request.app.get("GoogleMapsServices"));
//     console.dir(request.body);
//     response.send("Hello World!");
// });

// Heatmap-related endpoints

// Bins-related endpoints
router.get("/data/bins", bins.getBins);
router.put("/data/bins", bins.modifyBins);

// Vehicles-related endpoints
router.get("/data/vehicles", vehicles.getFleetVehicles);
router.put("/data/vehicles", vehicles.modifyFleetVehicles);

// Routes-related endpoints
router.get("/data/routes_last_updated", schedules.getBinCollectionSchedulesTimestamp);
router.get("/data/routes", schedules.getBinCollectionSchedules);

// 404 page send

export default router;
