import * as dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch";
import schedule from "node-schedule";
import express, { response } from "express";
import router from "./router";
import mongoose, { Mongoose } from "mongoose";
import * as HTTP from "./constants/http";
import * as MISC from "./constants/misc";
import SmartBin from "./models/smart-bin";
import DumbBin from "./models/dumb-bin";
import SmartBinDailyFillLevel from "./models/smart-bin-fill-level";
import FleetVehicle from "./models/fleet-vehicle";
import { SmartBinsInfo, SmartBinsCurrentFillLevelsInfo } from "./utils/helper";
import { GoogleMapsServices } from "./utils/google-maps-services";
import { distancematrix } from "@googlemaps/google-maps-services-js/dist/distance";
import BinDistance from "./models/bin-distance";
import smartBin from "./models/smart-bin";
import BinCollectionRoute from "./models/bin-collection-route";

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
console.log("Start connecting to the database...");
mongoose.connect(
    "mongodb://" + process.env.DB_HOST + ":" + process.env.DB_PORT + "/" + process.env.DB_NAME,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        poolSize: 10,
    }
).catch(console.error.bind(console, "Initial connection error: "));
mongoose.connection.on("error", console.error.bind(console, "Connection error: "));

mongoose.connection.once("open", function() {
    console.log("A connection to the database is successfully established");

    mongoose.connection.db.collection("SmartBins").countDocuments(async function(error, count) {
        if (error) return console.error(error);
        googleMapsServices.computeDirections(bins[0], bins[25], bins.slice(1, 25)).then(data => {
            console.log(data);
            console.log(data[0].routes);
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
        });
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
                                originBinType: "SmartBin",
                                destination: smartBins[destinationIndex]._id,
                                destinationBinType: "SmartBin",
                                distance: col.distance,
                                duration: col.duration
                            }))
                        ), function(error, binDistances) {
                            if (error) return console.error(error);
                            console.log("Initial population of distances between each pair of smart bins completes successfully");
                        }
                    );
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
//     rego: "ZPW772",
//     capacity: 10.512451234124125125124123123,
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

const app = express();

app.use("/", router);
app.listen(8080);
