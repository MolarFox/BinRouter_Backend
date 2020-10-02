import * as dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import schedule from "node-schedule";
import express from "express";
import mongoose from "mongoose";
import router from "./router";
import Database from "./database";
import * as HTTP from "./constants/http";
import * as MISC from "./constants/misc";
import SmartBin from "./models/smart-bin";
import DumbBin from "./models/dumb-bin";
import SmartBinDailyFillLevel from "./models/smart-bin-fill-level";
import { SmartBinsInfo, SmartBinsCurrentFillLevelsInfo } from "./utils/type-information";
import { GoogleMapsServices } from "./utils/google-maps-services";
import { distancematrix } from "@googlemaps/google-maps-services-js/dist/distance";
import FleetVehicle from "./models/fleet-vehicle";
import BinDistance from "./models/bin-distance";
import Depot from "./models/depot";
import BinCollectionRoute from "./models/bin-collection-route";
import { updateBinDistances, convertFromDistanceMatrixToBinDistanceDocuments } from "./controllers/bin";

// Load all environment variables from the .env configuration file
let dotenvResult;
switch(process.env.NODE_ENV) {
    case "development":
        console.log("Start initialization of development environment...");   
        dotenvResult = dotenv.config({
            path: path.join(__dirname, "config/.env.development")
        });
        break;
    case "production":
        console.log("Start initialization of production environment...");
        dotenvResult = dotenv.config({
            path: path.join(__dirname, "config/.env.production")
        });
        break;
    default:
        throw new Error(`Unrecognized ${process.env.NODE_ENV} environment`);
}
if (dotenvResult.error) throw dotenvResult.error;
console.log("Environment is initialized successfully");

const googleMapsServices = new GoogleMapsServices();
const bins = [
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6601949611,
        latitude: -37.9018111376
    }, 
    {
        longitude: 144.6614092517,
        latitude: -37.9007616667,
    },
    {
        longitude: 144.6514192517,
        latitude: -37.9017716667,
    },
    {
        longitude: 144.662400,
        latitude: -37.901760,
    },
]

// Start connecting to mongodb first
Database.connect().then((connection) => {
    connection.db.collection("SmartBins").countDocuments(async function(error, count) {
        if (error) return console.error(error);
        // googleMapsServices.computeDirections(bins[0], bins[25], bins.slice(1, 25)).then(data => {
        //     console.log(data);
        //     console.log(data[0].routes);
            // const route = new BinCollectionRoute({
            //     _id: new mongoose.Types.ObjectId(),
            //     searchStrategy: "AUTOMATIC",
            //     routeByVehicle: [
            //         {
            //             vehicle: "5f73fea3a3af8f1ab7fa9dd5",
            //             path: data
            //         }
            //     ]
            // });
            // route.save(function(err, doc) {
            //     if (err) return console.error(err);
            //     console.log(doc);
            // })
            // console.log(data[0].routes[0].legs);
        // });
        if (count === 0) {
            const smartBinsCurrentFillLevelsInfo = 
                await fetch(process.env.SMART_BINS_CURRENT_FILL_LEVELS_URL as string)
                        .then(response => response.json() as Promise<SmartBinsCurrentFillLevelsInfo>)
            const smartBinsCurrentFillLevels: { 
                [serialNumber: number]: {
                    serialNumber: number,
                    fullness: number,
                    timestamp: Date
                }
            } = {};
            smartBinsCurrentFillLevelsInfo.features.forEach(smartBinCurrentFillLevel => 
                smartBinsCurrentFillLevels[smartBinCurrentFillLevel.properties.serial_num] = {
                    serialNumber: smartBinCurrentFillLevel.properties.serial_num,
                    fullness: smartBinCurrentFillLevel.properties.fill_lvl,
                    timestamp: new Date(smartBinCurrentFillLevel.properties.timestamp)
                }
            );

            const smartBinsInfo = 
                await fetch(process.env.SMART_BINS_URL as string)
                        .then(response => response.json() as Promise<SmartBinsInfo>);

            SmartBin.insertMany(
                smartBinsInfo.features.map(smartBin => ({
                    _id: new mongoose.Types.ObjectId(),
                    serialNumber: smartBin.properties.serial_number,
                    location: smartBin.geometry,
                    address: smartBin.properties.bin_detail,
                    threshold: smartBin.properties.fullness_threshold,
                    currentFullness: smartBinsCurrentFillLevels[smartBin.properties.serial_number].fullness,
                    lastUpdated: smartBin.properties.last_updated
                })), async function(error, smartBins) {
                    if (error) return console.error(error);
                    console.log("Initial population of smart bins data completes successfully");
                    
                    const smartBinsLocation = smartBins.map((smartBin: any) => ({
                        latitude: smartBin.location.coordinates[1] as number,
                        longitude: smartBin.location.coordinates[0] as number
                    }));
                    const distanceMatrix = await googleMapsServices.computeDistanceMatrix(smartBinsLocation, smartBinsLocation);
                    console.log("Initial computation of distances between each pair of smart bins completes successfully");
                    BinDistance.insertMany(
                        distanceMatrix.flatMap((row, originIndex) => 
                            row.map((col, destinationIndex) => ({
                                origin: smartBins[originIndex]._id,
                                originType: "SmartBin",
                                destination: smartBins[destinationIndex]._id,
                                destinationType: "SmartBin",
                                distance: col.distance,
                                duration: col.duration
                            }))
                        ), function(error, binDistances) {
                            if (error) return console.error(error);
                            console.log("Initial population of distances between each pair of smart bins completes successfully");
                        }
                    );
                    // insert distances between bins and depots
                    Depot.find({}).exec(function(error, depots) {
                        const depotsIdLocation = depots.map((depot: any) => ({
                            _id: depot._id,
                            longitude: depot.location.coordinates[1],
                            latitude: depot.location.coordinates[0]
                        }));
                        const depotsLocation = depots.map((depot: any) => ({
                            longitude: depot.location.coordinates[1],
                            latitude: depot.location.coordinates[0]
                        }));
                        Promise
                            .all([
                                googleMapsServices
                                    .computeDistanceMatrix(depotsLocation, depotsLocation),
                                googleMapsServices
                                    .computeDistanceMatrix(depotsLocation, smartBinsLocation),
                                googleMapsServices
                                    .computeDistanceMatrix(smartBinsLocation, depotsLocation)
                            ])
                            .then((distanceMatrices) => {
                                const smartBinsIdLocation = smartBins.map((smartBin: any) => ({
                                    _id: smartBin._id,
                                    latitude: smartBin.location.coordinates[1] as number,
                                    longitude: smartBin.location.coordinates[0] as number
                                }));
                                return Promise.all([
                                    convertFromDistanceMatrixToBinDistanceDocuments(
                                        distanceMatrices[0],
                                        depotsIdLocation,
                                        "Depot",
                                        depotsIdLocation,
                                        "Depot"
                                    ),
                                    convertFromDistanceMatrixToBinDistanceDocuments(
                                        distanceMatrices[1],
                                        depotsIdLocation,
                                        "Depot",
                                        smartBinsIdLocation,
                                        "SmartBin"
                                    ),
                                    convertFromDistanceMatrixToBinDistanceDocuments(
                                        distanceMatrices[2],
                                        smartBinsIdLocation,
                                        "SmartBin",
                                        depotsIdLocation,
                                        "Depot"
                                    )
                                ]);
                            })
                            .then((binDistancesInfo) => BinDistance.insertMany(binDistancesInfo.flatMap(binDistanceInfo => binDistanceInfo)))
                            .then((result) => {
                                console.log("Success!", result);
                            });
                    });
            });

            SmartBinDailyFillLevel.insertMany(
                Object.values(smartBinsCurrentFillLevels), 
                function(error, docs) {
                    if (error) return console.error(error);
                    console.log("Initial population of smart bins daily fill levels data completes successfully");
                }
            );

        } else {
            // TODO: update the database when new data comes in
        }
    });
});

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

schedule.scheduleJob(MISC.DAILY_UPDATE_TIME, (fireTime) => {
    fetch(process.env.SMART_BIN_CURRENT_FILL_LEVEL_URL as string, { method: HTTP.GET })
        .then(response => response.json())
        .then(data => {
        console.log(data);
    });
    console.log(fireTime);
});

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
//         insertOne: {
//             document: {
//                 _id: new mongoose.Types.ObjectId(),
//                 rego: "EFEFEF",
//                 capacity: 100,
//                 available: true,
//                 icon: -1,
//                 belongTo: undefined
//             }
//         }
//     },
    // {
    //     insertOne: {
    //         document: {
    //             _id: new mongoose.Types.ObjectId(),
    //             rego: "EFEFEF",
    //             capacity: 200,
    //             available: false,
    //             icon: 10,
    //             belongTo: undefined
    //         }
    //     }
    // },
    // {
    //     deleteOne: {
    //         filter: {
    //             rego: "ABABA",
    //             available: true
    //         }
    //     }
    // },
    // {
    //     updateOne: {
    //         filter: {
    //             rego: "ABABAB"
    //         },
    //         update: {
    //             rego: "ABABAB",
    //             capacity: 500,
    //             available: true,
    //             icon: 1000,
    //             belongTo: null
    //         }
    //     }
    // },
// ]).then(res => console.log(res)).catch(error => console.error(error.writeErrors[0]));

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

const app = express();

app.set("GoogleMapsServices", googleMapsServices);
app.use(express.json());
app.use("/", router);
app.listen(8080);

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