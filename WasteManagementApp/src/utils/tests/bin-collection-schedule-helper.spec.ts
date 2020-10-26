import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import fse from "fs-extra";
import path from "path";
import mongoose from "mongoose";
import { Database } from "../../database";
import BinDistance from "../../models/bin-distance";
import Depot from "../../models/depot";
import DumbBin from "../../models/dumb-bin";
import SmartBin from "../../models/smart-bin";
import FleetVehicle from "../../models/fleet-vehicle";
import BinCollectionSchedule from "../../models/bin-collection-schedule";
import { GoogleMapsServicesAdapter } from "../google-maps-services-adapter";
import { BinCollectionScheduleHelper } from "../bin-collection-schedule-helper";
import { BinDistanceHelper } from "../bin-distance-helper";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("BinHelper", function() {
    const googleMapsServicesAdapter: GoogleMapsServicesAdapter = new GoogleMapsServicesAdapter();
    let connection: mongoose.Connection | undefined;
    let depots: mongoose.Document[] | undefined;
    let smartBins: mongoose.Document[] | undefined;
    let dumbBins: mongoose.Document[] | undefined;
    let fleetVehicles: mongoose.Document[] | undefined;
    let binDistances: mongoose.Document[] | undefined;
    let binCollectionSchedules: mongoose.Document[] | undefined;
    
    const dummyDepots = [{
        _id: new mongoose.Types.ObjectId(),
        location: {
            type: "Point",
            coordinates: [144.9624, -37.8105]
        },
        address: "Melbourne Central, Cnr La Trobe St &, Swanston St, Melbourne VIC 3000",
    }];
    const dummySmartBins = [{
        _id: new mongoose.Types.ObjectId(),
        serialNumber: 123456789,
        location: {
            type: "Point",
            coordinates: [145.1329835, -37.911782]
        },
        address: "Monash University Campus Centre, Wellington Rd, Clayton VIC 3800",
        capacity: 300, 
        threshold: 10,
        currentFullness: 10,
        lastUpdated: new Date()
    }];
    const dummyDumbBins = [{
        _id: new mongoose.Types.ObjectId(),
        serialNumber: 987654321,
        location: {
            type: "Point",
            coordinates: [145.136379004, -37.9132749884]
        },
        address: "Monash Sport, 42 Scenic Blvd, Clayton VIC 3800",
        capacity: 1000, 
        threshold: 20,
        currentFullness: 5,
        lastUpdated: new Date()
    }];
    const dummyFleetVehicles = [{
        _id: new mongoose.Types.ObjectId(),
        rego: "ZZZZZZ",
        capacity: 10000,
        available: true,
        icon: 0,
        homeDepot: dummyDepots[0]._id
    }];

    before("initialise the environment, and back up and delete all existing documents, and insert the testing documents to the database", async function() {
        this.timeout(50000);

        process.env.GOOGLE_MAPS_API_KEY = "AIzaSyB1p_lDJ2L-DH5GSnWtpqDs-Nol1vaDuG0";
        process.env.DB_HOST="localhost";
        process.env.DB_PORT="27017";
        process.env.DB_NAME="WasteManagementDB";
        connection = await Database.connect();

        if (!fse.existsSync("./routing_solver")) {
            const routing_solver_folder_absolute_path = path.resolve(__dirname, "../../../routing_solver");
            fse.mkdirSync("./routing_solver");
            fse.copySync(routing_solver_folder_absolute_path, "./routing_solver");
        }

        binDistances = await BinDistance.find({});
        depots = await Depot.find({});
        smartBins = await SmartBin.find({});
        dumbBins = await DumbBin.find({});
        fleetVehicles = await FleetVehicle.find({});
        binDistances = await BinDistance.find({});
        binCollectionSchedules = await BinCollectionSchedule.find({});

        await BinDistance.deleteMany({});
        await Depot.deleteMany({});
        await SmartBin.deleteMany({});
        await DumbBin.deleteMany({});
        await FleetVehicle.deleteMany({});
        await BinDistance.deleteMany({});
        await BinCollectionSchedule.deleteMany({});

        await Depot.insertMany(dummyDepots);
        await SmartBin.insertMany(dummySmartBins);
        await DumbBin.insertMany(dummyDumbBins);
        await FleetVehicle.insertMany(dummyFleetVehicles);
    });

    after("clean up the environment, and delete the testing documents, and restore the backup documents back to the database ", async function() {
        this.timeout(50000);

        if (fse.existsSync("./routing_solver")) {
            fse.removeSync("./routing_solver");
        }

        await BinDistance.deleteMany({});
        await Depot.deleteMany({});
        await SmartBin.deleteMany({});
        await DumbBin.deleteMany({});
        await FleetVehicle.deleteMany({});
        await BinDistance.deleteMany({});
        await BinCollectionSchedule.deleteMany({});

        await Depot.insertMany(depots);
        await SmartBin.insertMany(smartBins);
        await DumbBin.insertMany(dumbBins);
        await FleetVehicle.insertMany(fleetVehicles);
        await BinDistance.insertMany(binDistances);
        await BinCollectionSchedule.insertMany(binCollectionSchedules);

        await connection?.close();
    });

    describe("#updateBinCollectionSchedules", function() {
        it("should only produce a unique route with 4 nodes in total to visit", async function() {
            const binDistancesUpdateResult = await BinDistanceHelper.updateAllBinDistances(googleMapsServicesAdapter);
            expect(binDistancesUpdateResult).to.be.true;

            const binCollectionSchedulesUpdateResult = await BinCollectionScheduleHelper.updateBinCollectionSchedules();
            expect(binCollectionSchedulesUpdateResult).to.be.true;
            
            const updatedBinCollectionSchedules = await BinCollectionSchedule.find({}) as any[];
            expect(updatedBinCollectionSchedules.length).to.equal(1);
            expect(updatedBinCollectionSchedules[0].routes.length).to.equal(1);
            expect(updatedBinCollectionSchedules[0].routes[0].vehicle).to.deep.equal(dummyFleetVehicles[0]._id);
            expect(updatedBinCollectionSchedules[0].routes[0].visitingOrder.length).to.equal(4);
        }).timeout(50000);
    });
});
