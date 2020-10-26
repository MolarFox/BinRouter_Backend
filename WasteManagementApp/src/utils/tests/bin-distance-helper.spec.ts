import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import BinDistance from "../../models/bin-distance";
import Depot from "../../models/depot";
import DumbBin from "../../models/dumb-bin";
import SmartBin from "../../models/smart-bin";
import { GoogleMapsServicesAdapter } from "../google-maps-services-adapter";
import { BinDistanceHelper } from "../bin-distance-helper";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("BinDistanceHelper", function() {
    const googleMapsServicesAdapter: GoogleMapsServicesAdapter = new GoogleMapsServicesAdapter();
    let connection: mongoose.Connection | undefined;
    let depots: mongoose.Document[] | undefined;
    let smartBins: mongoose.Document[] | undefined;
    let dumbBins: mongoose.Document[] | undefined;
    let binDistances: mongoose.Document[] | undefined;
    
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

    before("connect to the database, and back up and delete all existing depots, smart bins, dumb bins, and bin distances, and insert the dummy depots, smart bins and dumb bins", async function() {
        process.env.GOOGLE_MAPS_API_KEY = "AIzaSyB1p_lDJ2L-DH5GSnWtpqDs-Nol1vaDuG0";
        process.env.DB_HOST="localhost";
        process.env.DB_PORT="27017";
        process.env.DB_NAME="WasteManagementDB";
        connection = await Database.connect();

        binDistances = await BinDistance.find({});
        depots = await Depot.find({});
        smartBins = await SmartBin.find({});
        dumbBins = await DumbBin.find({});

        await BinDistance.deleteMany({});
        await Depot.deleteMany({});
        await SmartBin.deleteMany({});
        await DumbBin.deleteMany({});

        await Depot.insertMany(dummyDepots);
        await SmartBin.insertMany(dummySmartBins);
        await DumbBin.insertMany(dummyDumbBins);
    });

    after("delete the dummy smart bins and dumb bins, and restore all backup smart bins and dumb bins, and disconnect from the database", async function() {
        await BinDistance.deleteMany({});
        await Depot.deleteMany({});
        await SmartBin.deleteMany({});
        await DumbBin.deleteMany({});
        await BinDistance.insertMany(binDistances);
        await Depot.insertMany(depots);
        await SmartBin.insertMany(smartBins);
        await DumbBin.insertMany(dumbBins);
        await connection?.close();
    });
    
    describe("#updateAllBinDistances", function() {
        it("should create in total 9 bin distance documents in BinDistances collection corresponding to a 3 * 3 distance matrix", async function() {
            const updateResult = await BinDistanceHelper.updateAllBinDistances(googleMapsServicesAdapter);
            expect(updateResult).to.be.true;

            const matchedOriginDocsForDepot = await BinDistance.find({
                origin: dummyDepots[0]._id,
                originType: "Depot"
            }) as any[];
            expect(matchedOriginDocsForDepot.length).to.equal(3);
            for (let i = 0; i < matchedOriginDocsForDepot.length; i++) {
                expect(matchedOriginDocsForDepot[i].distance).to.not.equal(-1);
                expect(matchedOriginDocsForDepot[i].duration).to.not.equal(-1);
            }
            const matchedDestinationDocsForDepot = await BinDistance.find({
                destination: dummyDepots[0]._id,
                destinationType: "Depot"
            }) as any[];
            expect(matchedDestinationDocsForDepot.length).to.equal(3);
            for (let i = 0; i < matchedDestinationDocsForDepot.length; i++) {
                expect(matchedDestinationDocsForDepot[i].distance).to.not.equal(-1);
                expect(matchedDestinationDocsForDepot[i].duration).to.not.equal(-1);
            }

            const matchedOriginDocsForDumbBin = await BinDistance.find({
                origin: dummyDumbBins[0]._id,
                originType: "DumbBin"
            }) as any[];
            expect(matchedOriginDocsForDumbBin.length).to.equal(3);
            for (let i = 0; i < matchedOriginDocsForDumbBin.length; i++) {
                expect(matchedOriginDocsForDumbBin[i].distance).to.not.equal(-1);
                expect(matchedOriginDocsForDumbBin[i].duration).to.not.equal(-1);
            }
            const matchedDestinationDocsForDumbBin = await BinDistance.find({
                destination: dummyDumbBins[0]._id,
                destinationType: "DumbBin"
            }) as any[];
            expect(matchedDestinationDocsForDumbBin.length).to.equal(3);
            for (let i = 0; i < matchedDestinationDocsForDumbBin.length; i++) {
                expect(matchedDestinationDocsForDumbBin[i].distance).to.not.equal(-1);
                expect(matchedDestinationDocsForDumbBin[i].duration).to.not.equal(-1);
            }

            const matchedOriginDocsForSmartBin = await BinDistance.find({
                origin: dummySmartBins[0]._id,
                originType: "SmartBin"
            }) as any[];
            expect(matchedOriginDocsForSmartBin.length).to.equal(3);
            for (let i = 0; i < matchedOriginDocsForSmartBin.length; i++) {
                expect(matchedOriginDocsForSmartBin[i].distance).to.not.equal(-1);
                expect(matchedOriginDocsForSmartBin[i].duration).to.not.equal(-1);
            }
            const matchedDestinationDocsForSmartBin = await BinDistance.find({
                destination: dummySmartBins[0]._id,
                destinationType: "SmartBin"
            }) as any[];
            expect(matchedDestinationDocsForSmartBin.length).to.equal(3);
            for (let i = 0; i < matchedDestinationDocsForSmartBin.length; i++) {
                expect(matchedDestinationDocsForSmartBin[i].distance).to.not.equal(-1);
                expect(matchedDestinationDocsForSmartBin[i].duration).to.not.equal(-1);
            }
        });
    });

    describe("#updateBinDistances", function() {
        it("should still have 9 bin distance documents in BinDistances collection with the exact same content as before", async function() {
            let updateResult = await BinDistanceHelper.updateBinDistances(
                googleMapsServicesAdapter,
                dummyDumbBins.map(dummyDumbBin => dummyDumbBin._id.toString()),
                dummyDumbBins.map(dummyDumbBin => ({
                    _id: dummyDumbBin._id.toString(),
                    longitude: dummyDumbBin.location.coordinates[0],
                    latitude: dummyDumbBin.location.coordinates[1]
                })),
                [],
                false
            );
            expect(updateResult).to.be.true;
            updateResult = await BinDistanceHelper.updateBinDistances(
                googleMapsServicesAdapter,
                dummySmartBins.map(dummySmartBin => dummySmartBin._id.toString()),
                [],
                dummySmartBins.map(dummySmartBin => ({
                    _id: dummySmartBin._id.toString(),
                    longitude: dummySmartBin.location.coordinates[0],
                    latitude: dummySmartBin.location.coordinates[1]
                })),
                true
            );
            expect(updateResult).to.be.true;

            const matchedOriginDocsForDepot = await BinDistance.find({
                origin: dummyDepots[0]._id,
                originType: "Depot"
            }) as any[];
            expect(matchedOriginDocsForDepot.length).to.equal(3);
            for (let i = 0; i < matchedOriginDocsForDepot.length; i++) {
                expect(matchedOriginDocsForDepot[i].distance).to.not.equal(-1);
                expect(matchedOriginDocsForDepot[i].duration).to.not.equal(-1);
            }
            const matchedDestinationDocsForDepot = await BinDistance.find({
                destination: dummyDepots[0]._id,
                destinationType: "Depot"
            }) as any[];
            expect(matchedDestinationDocsForDepot.length).to.equal(3);
            for (let i = 0; i < matchedDestinationDocsForDepot.length; i++) {
                expect(matchedDestinationDocsForDepot[i].distance).to.not.equal(-1);
                expect(matchedDestinationDocsForDepot[i].duration).to.not.equal(-1);
            }

            const matchedOriginDocsForDumbBin = await BinDistance.find({
                origin: dummyDumbBins[0]._id,
                originType: "DumbBin"
            }) as any[];
            expect(matchedOriginDocsForDumbBin.length).to.equal(3);
            for (let i = 0; i < matchedOriginDocsForDumbBin.length; i++) {
                expect(matchedOriginDocsForDumbBin[i].distance).to.not.equal(-1);
                expect(matchedOriginDocsForDumbBin[i].duration).to.not.equal(-1);
            }
            const matchedDestinationDocsForDumbBin = await BinDistance.find({
                destination: dummyDumbBins[0]._id,
                destinationType: "DumbBin"
            }) as any[];
            expect(matchedDestinationDocsForDumbBin.length).to.equal(3);
            for (let i = 0; i < matchedDestinationDocsForDumbBin.length; i++) {
                expect(matchedDestinationDocsForDumbBin[i].distance).to.not.equal(-1);
                expect(matchedDestinationDocsForDumbBin[i].duration).to.not.equal(-1);
            }

            const matchedOriginDocsForSmartBin = await BinDistance.find({
                origin: dummySmartBins[0]._id,
                originType: "SmartBin"
            }) as any[];
            expect(matchedOriginDocsForSmartBin.length).to.equal(3);
            for (let i = 0; i < matchedOriginDocsForSmartBin.length; i++) {
                expect(matchedOriginDocsForSmartBin[i].distance).to.not.equal(-1);
                expect(matchedOriginDocsForSmartBin[i].duration).to.not.equal(-1);
            }
            const matchedDestinationDocsForSmartBin = await BinDistance.find({
                destination: dummySmartBins[0]._id,
                destinationType: "SmartBin"
            }) as any[];
            expect(matchedDestinationDocsForSmartBin.length).to.equal(3);
            for (let i = 0; i < matchedDestinationDocsForSmartBin.length; i++) {
                expect(matchedDestinationDocsForSmartBin[i].distance).to.not.equal(-1);
                expect(matchedDestinationDocsForSmartBin[i].duration).to.not.equal(-1);
            }
        }).timeout(10000);
    });
});
