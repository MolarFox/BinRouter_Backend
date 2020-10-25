/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes all the express router-based operations including mounting the HTTP request 
 * handlers to their respective paths for the routing of the incoming HTTP requests to function correctly.
 */

import express from "express";
import * as bins from "./controllers/bin";
import * as vehicles from "./controllers/vehicle";
import * as schedules from "./controllers/schedule";

const router = express.Router();

// Bins-related endpoints
// Route all the HTTP GET requests to the specified path with the specified callback function, getBins
router.get("/data/bins", bins.getBins);
// Route all the HTTP PUT requests to the specified path with the specified callback function, modifyBins
router.put("/data/bins", bins.modifyBins);

// Vehicles-related endpoints
// Route all the HTTP GET requests to the specified path with the specified callback function, getFleetVehicles
router.get("/data/vehicles", vehicles.getFleetVehicles);
// Route all the HTTP PUT requests to the specified path with the specified callback function, modifyFleetVehicles
router.put("/data/vehicles", vehicles.modifyFleetVehicles);

// Routes-related endpoints
// Route all the HTTP GET requests to the specified path with the specified callback function, getBinCollectionSchedulesTimestamp
router.get("/data/routes_last_updated", schedules.getBinCollectionSchedulesTimestamp);
// Route all the HTTP GET requests to the specified path with the specified callback function, getBinCollectionSchedules
router.get("/data/routes", schedules.getBinCollectionSchedules);

export default router;
