import * as dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import schedule from "node-schedule";
import express from "express";
import mongoose from "mongoose";
import router from "./router";
import Database from "./database";
import * as MISC from "./constants/misc";
import SmartBin from "./models/smart-bin";
import DumbBin from "./models/dumb-bin";
import SmartBinFillLevel from "./models/smart-bin-fill-level";
import { SmartBinsJSON, SmartBinsCurrentFillLevelsJSON, mongooseInsertWriteOpResult, SmartBinInfo, BinUpdateInfo, BinCreateInfo, BinDeleteInfo, IdLatLng } from "./utils/type-information";
import { GoogleMapsServicesAdapter } from "./utils/google-maps-services-adapter";
import FleetVehicle from "./models/fleet-vehicle";
import Depot from "./models/depot";
import { BinDistanceHelper } from "./utils/bin-distance-helper";
import { BinCollectionScheduleHelper } from "./utils/bin-collection-schedule-helper";
import depotsInfo from "./initial_data/depots.json";
import dumbBinsInfo from "./initial_data/dumb_bins.json";
import fleetVehiclesInfo from "./initial_data/fleet_vehicles.json";
import { BinHelper } from "./utils/bin-helper";
import { Logger } from "./utils/logger";
import { INDEX_LOG_TAG } from "./constants/log-tag";
import smartBinFillLevel from "./models/smart-bin-fill-level";

Logger.initialise();

// Load all environment variables from the .env configuration file
let dotenvResult;
switch(process.env.NODE_ENV) {
    case "development":
        Logger.log("Starts initialization of development environment...", "\n");   
        dotenvResult = dotenv.config({
            path: path.join(__dirname, "config/.env.development")
        });
        break;
    case "production":
        Logger.log("Starts initialization of production environment...", "\n");
        dotenvResult = dotenv.config({
            path: path.join(__dirname, "config/.env.production")
        });
        break;
    default:
        const error = new Error(`Unrecognized ${process.env.NODE_ENV} environment`);
        Logger.verboseError(error);
        throw error;
}
if (dotenvResult.error) {
    Logger.verboseError(dotenvResult.error);
    throw dotenvResult.error;
}
Logger.log("Environment has been initialized successfully", "\n");

// Start connecting to mongodb first
Database.connect()
    .then(async (connection) => {
        const app = express();

        const googleMapsServicesAdapter = new GoogleMapsServicesAdapter();
        app.set("GoogleMapsServicesAdapter", googleMapsServicesAdapter);

        const smartBinsCountInitial = await SmartBin.countDocuments();
        if (smartBinsCountInitial === 0) {
            await populateInitialData(googleMapsServicesAdapter);
        }

        const recurrentUpdateJob = schedule.scheduleJob(MISC.DAILY_UPDATE_TIME, async (fireTime) => {
            await syncSmartBinsAndUpdateBinDistances(googleMapsServicesAdapter);
            await syncSmartBinsCurrentFillLevels();
            const binCollectionSchedulesUpdateResult = 
                await BinCollectionScheduleHelper.updateBinCollectionSchedules(googleMapsServicesAdapter);
            if (!binCollectionSchedulesUpdateResult) {
                Logger.verboseError(INDEX_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
                throw new Error("Failed to update bin collection schedules");
            }
            Logger.verboseLog(INDEX_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
            Logger.log("Update of bin collection schedules completed successfully", "\n");
        });

        if (smartBinsCountInitial !== 0) {
            recurrentUpdateJob.invoke();
        }

        app.use(express.json());
        app.use(function (request, response, next) {
            Logger.logRequest(new Date(), request.method, request.url, request.body);
            next();
        });
        app.use("/", express.static(path.join(__dirname, "views/")));
        app.use("/", router);
        app.listen(80);
    })
    .catch(error => Logger.error(error, "\n"));


async function populateInitialData(googleMapsServicesAdapter: GoogleMapsServicesAdapter) {
    const depots = depotsInfo.depots.map((depot) => 
        Object.assign(depot, {
            _id: new mongoose.Types.ObjectId()
        })
    );
    const depotsInsertResult = await Depot.insertMany(depots, {
        rawResult: true
    }) as unknown as mongooseInsertWriteOpResult;
    if (depotsInsertResult.result?.ok !== 1) {
        Logger.verboseError(INDEX_LOG_TAG, "depotsInsertResult", depotsInsertResult, "\n");
        throw new Error("Failed to insert initial depots data");
    }
    Logger.verboseLog(INDEX_LOG_TAG, "depotsInsertResult", depotsInsertResult, "\n");
    Logger.log("Population of initial depots data completed successfully", "\n")

    const fleetVehicles = fleetVehiclesInfo.fleetVehicles.map((fleetVehicle) => 
        Object.assign(fleetVehicle, {
            _id: new mongoose.Types.ObjectId(),
            homeDepot: depots[0]._id
        })
    );
    const fleetVehiclesInsertResult = await FleetVehicle.insertMany(fleetVehicles, {
        rawResult: true
    }) as unknown as mongooseInsertWriteOpResult;
    if (fleetVehiclesInsertResult.result?.ok !== 1) {
        Logger.verboseError(INDEX_LOG_TAG, "fleetVehiclesInsertResult", fleetVehiclesInsertResult, "\n");
        throw new Error("Failed to insert initial fleet vehicles data");
    }
    Logger.verboseLog(INDEX_LOG_TAG, "fleetVehiclesInsertResult", fleetVehiclesInsertResult, "\n");
    Logger.log("Population of initial fleet vehicles data completed successfully", "\n");

    const smartBinsCurrentFillLevelsInfo = 
        await fetch(process.env.SMART_BINS_CURRENT_FILL_LEVELS_URL as string)
                .then(response => response.json() as Promise<SmartBinsCurrentFillLevelsJSON>);
    const smartBinsCurrentFillLevels: { 
        [serialNumber: number]: {
            serialNumber: number,
            fullness: number,
            timestamp: Date
        }
    } = {};
    smartBinsCurrentFillLevelsInfo.features.forEach((smartBinCurrentFillLevelInfo) => 
        smartBinsCurrentFillLevels[smartBinCurrentFillLevelInfo.properties.serial_num] = {
            serialNumber: smartBinCurrentFillLevelInfo.properties.serial_num,
            fullness: smartBinCurrentFillLevelInfo.properties.fill_lvl,
            timestamp: new Date(smartBinCurrentFillLevelInfo.properties.timestamp)
        }
    );
    const smartBinsInfo = 
        await fetch(process.env.SMART_BINS_URL as string).then(response => response.json() as Promise<SmartBinsJSON>);
    const smartBins = smartBinsInfo.features.map((smartBinInfo) => ({
        _id: new mongoose.Types.ObjectId(),
        serialNumber: smartBinInfo.properties.serial_number,
        location: smartBinInfo.geometry,
        address: smartBinInfo.properties.bin_detail,
        capacity: smartBinInfo.properties.capacity,
        threshold: smartBinInfo.properties.fullness_threshold,
        currentFullness: smartBinsCurrentFillLevels[smartBinInfo.properties.serial_number].fullness,
        lastUpdated: smartBinInfo.properties.last_updated
    }));
    const smartBinsInsertResult = await SmartBin.insertMany(smartBins, {
        rawResult: true
    }) as unknown as mongooseInsertWriteOpResult;
    if (smartBinsInsertResult.result?.ok !== 1) {
        Logger.verboseError(INDEX_LOG_TAG, "smartBinsInsertResult", smartBinsInsertResult, "\n");
        throw new Error("Failed to insert initial smart bins data with their current fill levels");
    }
    Logger.verboseLog(INDEX_LOG_TAG, "smartBinsInsertResult", smartBinsInsertResult, "\n");
    Logger.log("Population of initial smart bins data with their current fill levels completed successfully", "\n");

    const smartBinFillLevelsInsertResult = await SmartBinFillLevel.insertMany(
        Object.values(smartBinsCurrentFillLevels), {
            rawResult: true
        }
    ) as unknown as mongooseInsertWriteOpResult;
    if (smartBinFillLevelsInsertResult.result?.ok !== 1) {
        Logger.verboseError(INDEX_LOG_TAG, "smartBinFillLevelsInsertResult", smartBinFillLevelsInsertResult, "\n");
        throw new Error("Failed to insert initial smart bins daily fill levels data");
    }
    Logger.verboseLog(INDEX_LOG_TAG, "smartBinFillLevelsInsertResult", smartBinFillLevelsInsertResult, "\n");
    Logger.log("Population of initial smart bins daily fill levels data completed successfully", "\n");

    const nearestSmartBins = await BinHelper.computeNearestSmartBins(
        dumbBinsInfo.dumbBins.map((dumbBin) => ({
            longitude: dumbBin.location.coordinates[0],
            latitude: dumbBin.location.coordinates[1],
        }))
    );
    const dumbBins = dumbBinsInfo.dumbBins.map((dumbBin, index) => 
        Object.assign(dumbBin, {
            _id: new mongoose.Types.ObjectId(),
            nearestSmartBin: nearestSmartBins[index]
        })
    );
    const dumbBinsInsertResult = await DumbBin.insertMany(dumbBins, {
        rawResult: true
    }) as unknown as mongooseInsertWriteOpResult;
    if (dumbBinsInsertResult.result?.ok !== 1) {
        Logger.verboseError(INDEX_LOG_TAG, "dumbBinsInsertResult", dumbBinsInsertResult, "\n");
        throw new Error("Failed to insert initial dumb bins data");
    }
    Logger.verboseLog(INDEX_LOG_TAG, "dumbBinsInsertResult", dumbBinsInsertResult, "\n");
    Logger.log("Population of initial dumb bins data completed successfully", "\n");

    const allBinDistancesUpdateResult = await BinDistanceHelper.updateAllBinDistances(googleMapsServicesAdapter);
    if (!allBinDistancesUpdateResult) {
        Logger.verboseError(INDEX_LOG_TAG, "allBinDistancesUpdateResult", allBinDistancesUpdateResult, "\n");
        throw new Error("Failed to insert initial bin distances data");
    }
    Logger.verboseLog(INDEX_LOG_TAG, "allBinDistancesUpdateResult", allBinDistancesUpdateResult, "\n");
    Logger.log("Population of initial bin distances data completed successfully", "\n");

    const binCollectionSchedulesUpdateResult = 
        await BinCollectionScheduleHelper.updateBinCollectionSchedules(googleMapsServicesAdapter);
    if (!binCollectionSchedulesUpdateResult) {
        Logger.verboseError(INDEX_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
        throw new Error("Failed to insert initial bin collection schedules data");
    }
    Logger.verboseLog(INDEX_LOG_TAG, "binCollectionSchedulesUpdateResult", binCollectionSchedulesUpdateResult, "\n");
    Logger.log("Population of initial bin collection schedules data completed successfully", "\n");
}

async function syncSmartBinsAndUpdateBinDistances(googleMapsServicesAdapter: GoogleMapsServicesAdapter) {
    const localSmartBins: { 
        [serialNumber: number]: SmartBinInfo
    } = {};
    const remoteSmartBins: {
        [serialNumber: number]: SmartBinInfo
    } = {};

    (await SmartBin.find({}) as unknown as SmartBinInfo[])
        .forEach((smartBinDoc) => localSmartBins[smartBinDoc.serialNumber] = smartBinDoc);
    (await fetch(process.env.SMART_BINS_URL as string).then(response => response.json() as Promise<SmartBinsJSON>))
        .features
        .forEach((smartBinInfo) => remoteSmartBins[smartBinInfo.properties.serial_number] = {
            serialNumber: smartBinInfo.properties.serial_number,
            location: smartBinInfo.geometry,
            address: smartBinInfo.properties.bin_detail,
            capacity: smartBinInfo.properties.capacity,
            threshold: smartBinInfo.properties.fullness_threshold,
            lastUpdated: new Date(smartBinInfo.properties.last_updated)
        });
    
    const localSmartBinsSerialNumbers = Object.keys(localSmartBins).map((serialNumber) => parseInt(serialNumber, 10));
    const remoteSmartBinsSerialNumbers = Object.keys(remoteSmartBins).map((serialNumber) => parseInt(serialNumber, 10));
    
    const smartBinsDelete = 
        localSmartBinsSerialNumbers
            .filter((serialNumber) => !remoteSmartBinsSerialNumbers.includes(serialNumber))
            .map((serialNumber) => localSmartBins[serialNumber]._id!) as BinDeleteInfo[];
    const smartBinsCreate = 
        remoteSmartBinsSerialNumbers
            .filter((serialNumber) => !localSmartBinsSerialNumbers.includes(serialNumber))
            .map((serialNumber) => ({
                _id: new mongoose.Types.ObjectId() as unknown as string,
                longitude: remoteSmartBins[serialNumber].location.coordinates[0],
                latitude: remoteSmartBins[serialNumber].location.coordinates[1],
                address: remoteSmartBins[serialNumber].address,
                capacity: remoteSmartBins[serialNumber].capacity,
                serialNumber: remoteSmartBins[serialNumber].serialNumber,
                threshold: remoteSmartBins[serialNumber].threshold,
                lastUpdated: remoteSmartBins[serialNumber].lastUpdated
            })) as BinCreateInfo[];
    const smartBinsUpdate = 
        localSmartBinsSerialNumbers
            .filter((serialNumber) => remoteSmartBinsSerialNumbers.includes(serialNumber))
            .map((serialNumber) => 
                localSmartBins[serialNumber].lastUpdated.getTime() !== remoteSmartBins[serialNumber].lastUpdated.getTime() ? {
                    _id: localSmartBins[serialNumber]._id!,
                    longitude: remoteSmartBins[serialNumber].location.coordinates[0],
                    latitude: remoteSmartBins[serialNumber].location.coordinates[1],
                    address: remoteSmartBins[serialNumber].address,
                    capacity: remoteSmartBins[serialNumber].capacity,
                    threshold: remoteSmartBins[serialNumber].threshold,
                    lastUpdated: remoteSmartBins[serialNumber].lastUpdated,
                } : null
            )
            .filter(smartBin => smartBin) as BinUpdateInfo[];
    
    if (smartBinsDelete.length !== 0 || smartBinsCreate.length !== 0 || smartBinsUpdate.length !== 0) {
        const smartBinsUpdateBulkWriteResult = await BinHelper.updateBins(
            smartBinsDelete, 
            smartBinsCreate,
            smartBinsUpdate,
            true
        );
        if (!smartBinsUpdateBulkWriteResult) {
            Logger.verboseError(INDEX_LOG_TAG, "smartBinsUpdateBulkWriteResult", smartBinsUpdateBulkWriteResult, "\n");
            throw new Error("Failed to synchronise smart bins data with the remote server");
        }
        Logger.verboseLog(INDEX_LOG_TAG, "smartBinsUpdateBulkWriteResult", smartBinsUpdateBulkWriteResult, "\n");
        Logger.log("Synchronisation of smart bins data with the remote server completed successfully", "\n");

        const binDistancesUpdateResult = await BinDistanceHelper.updateBinDistances(
            googleMapsServicesAdapter, 
            smartBinsDelete, 
            smartBinsCreate, 
            smartBinsUpdate, 
            true 
        );
        if (!binDistancesUpdateResult) {
            Logger.verboseError(INDEX_LOG_TAG, "binDistancesUpdateResult", binDistancesUpdateResult, "\n");
            throw new Error("Failed to update bins distances");
        }
        Logger.verboseLog(INDEX_LOG_TAG, "binDistancesUpdateResult", binDistancesUpdateResult, "\n");
        Logger.log("Update of bins distances completed successfully", "\n");
        
        const dumbBinsUpdateOnNearestSmartBinsResult = 
            await BinHelper.updateNearestSmartBins(
                await DumbBin.aggregate([
                    {
                        $project: {
                            longitude: {
                                $arrayElemAt: ["$location.coordinates", 0]
                            },
                            latitude: {
                                $arrayElemAt: ["$location.coordinates", 1]
                            }
                        }
                    }
                ]) as IdLatLng[]
            );
        if (!dumbBinsUpdateOnNearestSmartBinsResult) {
            Logger.verboseError(INDEX_LOG_TAG, "dumbBinsUpdateOnNearestSmartBinsResult", dumbBinsUpdateOnNearestSmartBinsResult, "\n");
            throw new Error("Failed to update dumb bins' nearest smart bins");
        }
        Logger.verboseLog(INDEX_LOG_TAG, "dumbBinsUpdateOnNearestSmartBinsResult", dumbBinsUpdateOnNearestSmartBinsResult, "\n");
        Logger.log("Update of dumb bins' nearest smart bins completed successfully", "\n");
    }
}

async function syncSmartBinsCurrentFillLevels() {
    const smartBinsCurrentFillLevels = 
        (await fetch(process.env.SMART_BINS_CURRENT_FILL_LEVELS_URL as string).then(response => response.json() as Promise<SmartBinsCurrentFillLevelsJSON>))
            .features
            .map((smartBinCurrentFillLevelInfo) => ({
                serialNumber: smartBinCurrentFillLevelInfo.properties.serial_num,
                fullness: smartBinCurrentFillLevelInfo.properties.fill_lvl,
                timestamp: new Date(smartBinCurrentFillLevelInfo.properties.timestamp)
            }));
    
    if (smartBinsCurrentFillLevels.length > 0) {
        const smartBinMatchedDoc = await smartBinFillLevel.findOne({
            timestamp: smartBinsCurrentFillLevels[0].timestamp
        });
        if (!smartBinMatchedDoc) {
            const smartBinsUpdateOnCurrentFullnessesBulkWriteResult = await SmartBin.bulkWrite(
                smartBinsCurrentFillLevels.map((smartBinCurrentFillLevel) => ({
                    updateOne: {
                        filter: {
                            serialNumber: smartBinCurrentFillLevel.serialNumber
                        },
                        update: {
                            currentFullness: smartBinCurrentFillLevel.fullness
                        }
                    }
                }))
            );
            if (!smartBinsUpdateOnCurrentFullnessesBulkWriteResult) {
                Logger.verboseError(
                    INDEX_LOG_TAG, 
                    "smartBinsUpdateOnCurrentFullnessesBulkWriteResult", 
                    smartBinsUpdateOnCurrentFullnessesBulkWriteResult, 
                    "\n"
                );
                throw new Error("Failed to update smart bins' current fullnesses");
            }
            Logger.verboseLog(
                INDEX_LOG_TAG, 
                "smartBinsUpdateOnCurrentFullnessesBulkWriteResult", 
                smartBinsUpdateOnCurrentFullnessesBulkWriteResult, 
                "\n"
            );
            Logger.log("Update of smart bins' current fullnesses completed successfully", "\n");

            const smartBinFillLevelsInsertResult = await SmartBinFillLevel.insertMany(smartBinsCurrentFillLevels, {
                rawResult: true
            }) as unknown as mongooseInsertWriteOpResult;
            if (smartBinFillLevelsInsertResult.result?.ok !== 1) {
                Logger.verboseError(INDEX_LOG_TAG, "smartBinFillLevelsInsertResult", smartBinFillLevelsInsertResult, "\n");
                throw new Error("Failed to insert smart bin fill levels");
            }
            Logger.verboseLog(INDEX_LOG_TAG, "smartBinFillLevelsInsertResult", smartBinFillLevelsInsertResult, "\n");
            Logger.log("Insertion of current smart bin fill levels completed successfully", "\n");        
        }
    }
}


// DumbBin.aggregate([
//     {
//         $project: {
//             longitude: {
//                 $arrayElemAt: ["$location.coordinates", 0]
//             },
//             latitude: {
//                 $arrayElemAt: ["$location.coordinates", 1]
//             }
//         }
//     }
// ]).then(x => console.log(x));


// const googleMapsServices = new GoogleMapsServices();
// googleMapsServices.computeDistanceMatrix(origins, destinations).then(distanceMatrix => distanceMatrix.forEach((row, i) => row.forEach((col, j) => console.log(`row: ${i}, col: ${j}\n`, col, "\n"))))

// client
//     .distancematrix({
//         params: {
//             origins: origins,
//             destinations: destinations,
//             mode: TravelMode.driving,
//             units: UnitSystem.metric,
//             language: "en-AU",
//             key: process.env.GOOGLE_MAPS_API_KEY as string
//         }
//     })
//     .then(response => {   
//         response.data.rows.forEach(row => 
//             row.elements.forEach(col =>
//                 console.log(col)
//             )
//         );
//     })

// new FleetVehicle({
//     _id: new mongoose.Types.ObjectId(),
//     rego: "ZZZZZ",
//     capacity: 10.1,
//     available: true,
//     icon: 1
// }).save(function(err) {
//     if (err) return console.error(err);
//     console.log("saved!");
// });


// new SmartBinDailyFillLevel({
//     _id: new mongoose.Types.ObjectId(),
//     serialNumber: 123456789,
//     fullness: 0.5,
//     timestamp: "2018-06-29"
// }).save(function(err) {
//     if (err) return console.error(err);
//     console.log("saved!");
// });

// new DumbBin({
//     _id: new mongoose.Types.ObjectId(),
//     serialNumber: 123456789,
//     location: {
//         type: "Point",
//         coordinates: [144.6614092517, -37.9007616667]
//     },
//     address: "Cash Converters G Werribee",
//     capacity: 99.67,
//     nearestSmartBinId: new mongoose.Types.ObjectId()
// }).save(function(err) {
//     if (err) return console.error(err);
//     console.log("saved!");
// });

// new SmartBin({
//     _id: new mongoose.Types.ObjectId(),
//     serialNumber: 123456789,
//     location: {
//         type: "Point",
//         coordinates: [144.6614092517, -37.9007616667]
//     },
//     address: "Cash Converters G Werribee",
//     capacity: 99.67,
//     threshold: 0.8,
//     currentFullness: undefined
// }).save(function(err) {
//     if (err) return console.error(err);
//     console.log("saved!");
// });

// SmartBin.where("currentFullness").ne(null).exec(function(err, docs) {
//     console.log(docs);
// })

// setTimeout(
//     () => {
//         // const x = fetch(URL.SMART_BINS, {
//         //     method: HTTP.GET,
//         // });
//         // x.then(console.log);
//     },
//     (
//         (): number => {
//             const currentTime = new Date();
//             MISC.DAILY_UPDATE_TIME.setFullYear(currentTime.getFullYear());
//             MISC.DAILY_UPDATE_TIME.setMonth(currentTime.getMonth());
//             MISC.DAILY_UPDATE_TIME.setDate(currentTime.getDate());
//             if (MISC.DAILY_UPDATE_TIME < currentTime)
//             const millisecondsToWait = 
//                 currentTime < MISC.DAILY_UPDATE_TIME ? 
//                 MISC.DAILY_UPDATE_TIME - currentTime : ;
//             return millisecondsToWait;
//         }
//     )()
// );

// new Depot({
//     _id: new mongoose.Types.ObjectId(),
//     location: {
//         type: "Point",
//         coordinates: [-1, 1]
//     },
//     address: "Monash University"
// }).save();

// new FleetVehicle({
//     _id: new mongoose.Types.ObjectId(),
//     rego: "ABCDEF",
//     capacity: 120,
//     available: true,
//     icon: -1,
//     belongTo: "5f73fea8a3af8f1ab7fa9116"
// }).save(function(err, doc) {
//     if (err) return console.error(err);
//     console.log("Saved!");
// });

// new DumbBin({
//     _id: new mongoose.Types.ObjectId(),
//     location: {
//         type: "Point",
//         coordinates: [-66, 66]
//     },
//     address: "Australia",
//     capacity: 666,
//     nearestSmartBin: "5f73fea3a3af8f1ab7fa90c6"
// }).save(function(err, doc) {
//     if (err) return console.error(err);
//     console.log("Saved!");
// });

// FleetVehicle.bulkWrite([
//     {
//         deleteOne: {
//             filter: {
//                 rego: "ABABA",
//                 available: true
//             }
//         }
//     },
//     {
//         updateOne: {
//             filter: {
//                 rego: "GHJKL"
//             },
//             update: {
//                 rego: "ZZZZZ",
//                 capacity: 6666,
//                 available: true,
//                 icon: 10,
//                 homeDepot: null
//             }
//         }
//     },
//     {
//         insertOne: {
//             document: {
//                 _id: new mongoose.Types.ObjectId(),
//                 rego: "CZCZCZ",
//                 capacity: 1000,
//                 available: false,
//                 icon: 6,
//                 homeDepot: undefined
//             }
//         }
//     },
//     {
//         insertOne: {
//             document: {
//                 _id: new mongoose.Types.ObjectId(),
//                 rego: "HDHDHD",
//                 capacity: 2000,
//                 available: false,
//                 icon: 10,
//                 homeDepot: undefined
//             }
//         }
//     },
// ]).then(res => console.dir(res, {depth: 5})).catch(error => console.error(error.writeErrors[0]));

// FleetVehicle.where("belongTo").ne(undefined).exec(function(error, result) {
//     console.log(result);
// })

// FleetVehicle.deleteMany({
//     $and: [
//         {
//             available: true
//         },
//         {
//             rego: {
//                 $in: ["ZZZZZ", "EFEFEF"]
//             }
//         }
//     ]
// }).then(res => console.log(res));


// BinDistance.insertMany([{
    
// }])
// BinDistance.deleteOne({duration: undefined}).exec((err, res) => console.log(res));
// BinDistance.find({duration: undefined}).exec((err, res) => console.log(res));
// computeBinDistances(googleMapsServices, ["5f771ce4692113ab337ceffd", "5f771d39692113ab337ceffe"], [], [{_id: "5f771d5d692113ab337cefff", latitude: 1, longitude: 2}], true).then(() => {});
// SmartBin.find({}, "_id location.coordinates").then((docs) => {console.log(docs)});
// SmartBin.aggregate([
//     {
//         $match: {
//             _id: {
//                 $in: [new mongoose.Types.ObjectId("5f7598e78cc1903f8e7a541a"), new mongoose.Types.ObjectId("5f7598e78cc1903f8e7a541b")]
//             }
//         }
//     },
//     {
//         $project: {
//             _id: true,
//             latitude: {
//                 $arrayElemAt: ["$location.coordinates", 1]
//             },
//             longitude: {
//                 $arrayElemAt: ["$location.coordinates", 0]
//             }
//         }
//     }
// ]).then(docs => {console.log(docs.length)})

// SmartBin.find({}).exec(function(error, smartBins) {
//     const deletedBinsInfo = smartBins.map((smartBin) => smartBin._id);
//     const createdBinsInfo = smartBins.map((smartBin: any) => ({
//         _id: smartBin._id,
//         longitude: smartBin.location.coordinates[0],
//         latitude: smartBin.location.coordinates[1]
//     }));
//     updateBinDistances(
//         googleMapsServices,
//         deletedBinsInfo,
//         createdBinsInfo,
//         [],
//         true
//     ).then((docs) => {
//         console.log(docs);
//     });
// })

// DumbBin.insertMany(
//     [{
//         _id: new mongoose.Types.ObjectId(),
//         serialNumber: 66666666,
//         location: {
//             type: "Point",
//             coordinates: [144.6664092517, -37.9097616667]
//         },
//         address: "Cash Converters A Werribee",
//         capacity: 99.67,
//         nearestSmartBinId: new mongoose.Types.ObjectId()
//     }],
//     {
//         rawResult: true
//     },
//     function(error, res) {
//         console.dir(res, { depth: 6 });
//     }
// )

// DumbBin.find({}).exec(function(error, dumbBins) {
//     console.log(dumbBins);
//     console.log((dumbBins[0] as any).location.coordinates);
//     dumbBins.forEach((dumbBin: any) => {
//         SmartBin.findOne({
//             location: {
//                 $near: {
//                     $geometry: dumbBin.location,
//                     $maxDistance: 1000
//                 }
//             }
//         }, "_id").exec(function(error, smartBin) {
//             console.log(smartBin);
//         });
//     });
// });

// SmartBin.findById("5f7bfd762815199d74a8b5a8").then(console.log)

// const pwd = spawn(MISC.ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH, ["0,548,776,696,582,274,502,194,308,194,536,502,388,354,468,776,662-548,0,684,308,194,502,730,354,696,742,1084,594,480,674,1016,868,1210-776,684,0,992,878,502,274,810,468,742,400,1278,1164,1130,788,1552,754-696,308,992,0,114,650,878,502,844,890,1232,514,628,822,1164,560,1358-582,194,878,114,0,536,764,388,730,776,1118,400,514,708,1050,674,1244-274,502,502,650,536,0,228,308,194,240,582,776,662,628,514,1050,708-502,730,274,878,764,228,0,536,194,468,354,1004,890,856,514,1278,480-194,354,810,502,388,308,536,0,342,388,730,468,354,320,662,742,856-308,696,468,844,730,194,194,342,0,274,388,810,696,662,320,1084,514-194,742,742,890,776,240,468,388,274,0,342,536,422,388,274,810,468-536,1084,400,1232,1118,582,354,730,388,342,0,878,764,730,388,1152,354-502,594,1278,514,400,776,1004,468,810,536,878,0,114,308,650,274,844-388,480,1164,628,514,662,890,354,696,422,764,114,0,194,536,388,730-354,674,1130,822,708,628,856,320,662,388,730,308,194,0,342,422,536-468,1016,788,1164,1050,514,514,662,320,274,388,650,536,342,0,764,194-776,868,1552,560,674,1050,1278,742,1084,810,1152,274,388,422,764,0,798-662,1210,754,1358,1244,708,480,856,514,468,354,844,730,536,194,798,0", "0,1,1,2,4,2,4,8,8,1,2,1,2,4,4,8,8", "15,15,15,15", "0"], {shell: true});
// pwd.stdout.on("data", (data) => {
//     console.log(1);
//     console.log(data.toString());
// });
// console.log(pwd);
// console.log(pwd.killed, pwd.exitCode);
// pwd.kill("SIGKILL");
// pwd.on("close", (code, signal) => {
//     console.log('Process close event with code: ', signal);
// })
// pwd.on("exit", (code, signal) => {
//     console.log('Process exit event with code: ', signal);
//     pwd.kill("SIGKILL");
// })
// setTimeout(()=> {
//     console.log(pwd.exitCode);
// }, 1000);

// BinDistance.aggregate([
//     {
//         $match: {
//             distance: {
//                 $lt: 0
//             }
//         }
//     }
// ]).then(x => console.log("Hello", x.length));

// Depot.find({}).exec(function(error, depots) {
//     const depotsIdLocation = depots.map((depot: any) => ({
//         _id: depot._id,
//         longitude: depot.location.coordinates[1],
//         latitude: depot.location.coordinates[0]
//     }));
//     const depotsLocation = depots.map((depot: any) => ({
//         longitude: depot.location.coordinates[1],
//         latitude: depot.location.coordinates[0]
//     }));
//     console.log(depotsIdLocation, depotsLocation)
// });

// SmartBin.findById("5f7bfd762815199d74a8b5bf").then(console.log);
// googleMapsServices.computeDistanceMatrix([{latitude: -37, longitude: 145}], [{latitude: -37.88323, longitude: 144.7352166667}]).then(console.log);
// const routingSolver = spawn(MISC.ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH, ["0,548,776,696,582,274,502,194,308,194,536,502,388,354,468,776,662-548,0,684,308,194,502,730,354,696,742,1084,594,480,674,1016,868,1210-776,684,0,992,878,502,274,810,468,742,400,1278,1164,1130,788,1552,754-696,308,992,0,114,650,878,502,844,890,1232,514,628,822,1164,560,1358-582,194,878,114,0,536,764,388,730,776,1118,400,514,708,1050,674,1244-274,502,502,650,536,0,228,308,194,240,582,776,662,628,514,1050,708-502,730,274,878,764,228,0,536,194,468,354,1004,890,856,514,1278,480-194,354,810,502,388,308,536,0,342,388,730,468,354,320,662,742,856-308,696,468,844,730,194,194,342,0,274,388,810,696,662,320,1084,514-194,742,742,890,776,240,468,388,274,0,342,536,422,388,274,810,468-536,1084,400,1232,1118,582,354,730,388,342,0,878,764,730,388,1152,354-502,594,1278,514,400,776,1004,468,810,536,878,0,114,308,650,274,844-388,480,1164,628,514,662,890,354,696,422,764,114,0,194,536,388,730-354,674,1130,822,708,628,856,320,662,388,730,308,194,0,342,422,536-468,1016,788,1164,1050,514,514,662,320,274,388,650,536,342,0,764,194-776,868,1552,560,674,1050,1278,742,1084,810,1152,274,388,422,764,0,798-662,1210,754,1358,1244,708,480,856,514,468,354,844,730,536,194,798,0", "0,1,1,2,4,2,4,8,8,1,2,1,2,4,4,8,8", "15,15,15,15", "3"], {shell: true});
// routingSolver.stdout.on("data", (data) => {
//     console.log(data.toString());
// });

// BinCollectionScheduleHelper.createAllPossibleBinCollectionSchedules(new GoogleMapsServicesAdapter());
// BinDistanceHelper.computeAllBinDistances(new GoogleMapsServicesAdapter());
// googleMapsServices.computeDirections({latitude: -37.9018111376, longitude: 144.6601949611}, {latitude: -37.9018111376, longitude: 144.6601949611}, []).then(console.log);

// BinCollectionScheduleHelper
//     .createAllPossibleBinCollectionSchedules(googleMapsServices)
//     .then(binCollectionSchedules => {
//         console.dir(binCollectionSchedules, { depth: 5 });
//         return BinCollectionSchedule.insertMany(
//             binCollectionSchedules.map(binCollectionSchedule => 
//                 Object.assign(binCollectionSchedule, {
//                     _id: new mongoose.Types.ObjectId()
//                 })
//             ), {
//                 rawResult: true
//             }
//         )
//     })
//     .then(result => console.dir(result, { depth: 5 }));

// const id = new mongoose.Types.ObjectId();
// const id2 = new mongoose.Types.ObjectId(id);
// console.log(typeof id, typeof id2);