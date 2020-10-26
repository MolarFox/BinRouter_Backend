import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import mongodb from "mongodb";
import { Database } from "../../database";
import { BinHelper } from "../bin-helper";
import DumbBin from "../../models/dumb-bin";
import SmartBin from "../../models/smart-bin";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("BinHelper", function() {
    let connection: mongoose.Connection | undefined;
    let smartBins: mongoose.Document[] | undefined;
    let dumbBins: mongoose.Document[] | undefined;
    const dummySmartBins = [
        {
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
        }, 
        {
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
        }
    ];
    const dummyDumbBins = [
        {
            _id: new mongoose.Types.ObjectId(),
            location: {
                type: "Point",
                coordinates: [145.1341923, -37.9119321]
            },
            address: "Somewhere closer to campus centre",
            capacity: 200
        },
        {
            _id: new mongoose.Types.ObjectId(),
            location: {
                type: "Point",
                coordinates: [145.1377692, -37.9133834]
            },
            address: "Somewhere closer to monash sports",
            capacity: 1000
        },
        {
            _id: new mongoose.Types.ObjectId(),
            location: {
                type: "Point",
                coordinates: [145.1484554, -37.9228308]
            },
            address: "Nowhere closer to any of the above two locations",
            capacity: 100
        }
    ];

    before("connect to the database, and back up and delete all existing smart bins and dumb bins, and insert the dummy smart bins and dumb bins", async function() {
        process.env.DB_HOST="localhost";
        process.env.DB_PORT="27017";
        process.env.DB_NAME="WasteManagementDB";
        connection = await Database.connect();
        smartBins = await SmartBin.find({});
        dumbBins = await DumbBin.find({});
        await SmartBin.deleteMany({});
        await DumbBin.deleteMany({});
        await SmartBin.insertMany(dummySmartBins);
        await DumbBin.insertMany(dummyDumbBins);
    });

    after("delete the dummy smart bins and dumb bins, and restore all backup smart bins and dumb bins, and disconnect from the database", async function() {
        await SmartBin.deleteMany({});
        await DumbBin.deleteMany({});
        await SmartBin.insertMany(smartBins);
        await DumbBin.insertMany(dumbBins);
        await connection?.close();
    });

    describe("#verifyDumbBinDeleteInfo", function() {
        it("should return true", function() {
            let actualResult = BinHelper.verifyDumbBinDeleteInfo("111111111111");
            expect(actualResult).to.be.true;
            actualResult = BinHelper.verifyDumbBinDeleteInfo(new mongoose.Types.ObjectId().toString());
            expect(actualResult).to.be.true;
        });

        it("should return false", function() {
            let actualResult = BinHelper.verifyDumbBinDeleteInfo(undefined);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo(null);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo({x: 1});
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo(100);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo(new Date());
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo(false);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo("123456789");
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo("123456789123456789123456789123456789");
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinDeleteInfo(new mongoose.Types.ObjectId());
            expect(actualResult).to.be.false;
        });
    });

    describe("#verifyDumbBinCreateInfo", function() {
        it("should return true", function() {
            let actualResult = BinHelper.verifyDumbBinCreateInfo({
                longitude: -180,
                latitude: -90,
                address: "ABC",
                capacity: 1 
            });
            expect(actualResult).to.be.true;
            actualResult = BinHelper.verifyDumbBinCreateInfo({
                longitude: 180,
                latitude: 90,
                address: "ZZZ",
                capacity: 1000 
            });
            expect(actualResult).to.be.true;
        });
        
        it("should return false", function() {
            let actualResult = BinHelper.verifyDumbBinCreateInfo(undefined);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo(null);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo("x");
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo(100);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo(new Date());
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo(false);
            expect(actualResult).to.be.false;
            
            actualResult = BinHelper.verifyDumbBinCreateInfo({
                longitude: -181,
                latitude: 91,
                address: "ABC",
                capacity: 100
            });
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo({
                longitude: null,
                latitude: new Date(),
                address: "ABC",
                capacity: 100
            });
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo({
                longitude: 0,
                latitude: 0,
                address: "",
                capacity: 100
            });
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinCreateInfo({
                longitude: 0,
                latitude: 0,
                address: "ABC",
                capacity: 1001
            });
            expect(actualResult).to.be.false;
        });
    });

    describe("#verifyDumbBinUpdateInfo", function() {
        it("should return true", function() {
            let actualResult = BinHelper.verifyDumbBinUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                longitude: 0,
                latitude: 0,
                address: "ABC",
                capacity: 100
            });
            expect(actualResult).to.be.true;
            actualResult = BinHelper.verifyDumbBinUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                longitude: 0,
                latitude: 0,
                address: "A",
                capacity: 1000,
                somethingExtra: null
            });
            expect(actualResult).to.be.true;
        });
        
        it("should return false", function() {
            let actualResult = BinHelper.verifyDumbBinUpdateInfo(undefined);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo(null);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo("x");
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo(100);
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo(new Date());
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo(false);
            expect(actualResult).to.be.false;
            
            actualResult = BinHelper.verifyDumbBinUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                longitude: -181,
                latitude: 91,
                address: "ABC",
                capacity: 100
            });
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                longitude: null,
                latitude: new Date(),
                address: "ABC",
                capacity: 100
            });
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                longitude: 0,
                latitude: 0,
                address: "",
                capacity: 100
            });
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                longitude: 0,
                latitude: 0,
                address: "ABC",
                capacity: -1
            });
            expect(actualResult).to.be.false;
            actualResult = BinHelper.verifyDumbBinUpdateInfo({
                _id: "Invalid ID",
                longitude: 180,
                latitude: -90,
                address: "ABC",
                capacity: 100
            });
            expect(actualResult).to.be.false;
        });
    });

    describe("#computeNearestSmartBins", function() {
        it("should have each dummy dumb bin's nearestSmartBin field computed correctly", async function() {
            const nearestSmartBins = await BinHelper.computeNearestSmartBins(
                dummyDumbBins.map((dummyDumbBin) => ({
                    longitude: dummyDumbBin.location.coordinates[0],
                    latitude: dummyDumbBin.location.coordinates[1]
                })
            ));
            expect(nearestSmartBins[0]).to.deep.equal(dummySmartBins[0]._id);
            expect(nearestSmartBins[1]).to.deep.equal(dummySmartBins[1]._id);
            expect(nearestSmartBins[2]).to.be.undefined;
        });

        // Revealed the error that have been overlooked which is returned by the MongoDB, and it is not captured 
        // in the computeNearestSmartBins, which should implement some checking on the latitude and longitude
        it("should return 3 null values for 3 invalid LatLng objects", async function() {
            const nearestSmartBins = BinHelper.computeNearestSmartBins([
                {
                    longitude: -181,
                    latitude: -91
                }, 
                {
                    longitude: 181,
                    latitude: 91
                }
            ]);
            // expect(await nearestSmartBins).to.be.deep.equal([null, null]);
            expect(nearestSmartBins).to.be.rejectedWith(mongodb.MongoError);
        });
    });

    describe("#updateNearestSmartBins", function() {
        it("should return true as the update result, and should have each dummy dumb bin's nearestSmartBin field set accordingly", async function() {
            const updateResult = await BinHelper.updateNearestSmartBins(
                dummyDumbBins.map((dummyDumbBin) => ({
                    _id: dummyDumbBin._id.toString(),
                    longitude: dummyDumbBin.location.coordinates[0],
                    latitude: dummyDumbBin.location.coordinates[1]
                })
            ));
            expect(updateResult).to.be.true;
            let updatedDummyDumbBin = await DumbBin.findById(dummyDumbBins[0]._id) as any;
            expect(updatedDummyDumbBin.nearestSmartBin).to.deep.equal(dummySmartBins[0]._id);
            updatedDummyDumbBin = await DumbBin.findById(dummyDumbBins[1]._id) as any;
            expect(updatedDummyDumbBin.nearestSmartBin).to.deep.equal(dummySmartBins[1]._id);
            updatedDummyDumbBin = await DumbBin.findById(dummyDumbBins[2]._id) as any;
            // This reveals a minor expectation difference where we expect it to be returning a null instead of an undefined
            // although this type of difference doesn't make too much difference in our application as both evaluates to false 
            // when being used as a condition, however it reminds us not to compare a value directly with undefined or null
            expect(updatedDummyDumbBin.nearestSmartBin).to.be.null;
        });
    });

    describe("#updateBins", function() {
        it("should successfully delete, create, and update all the specified dumb bin documents", async function() {
            const binsDeleteInfo = [dummyDumbBins[0]._id, dummyDumbBins[1]._id].map(_id => _id.toString());
            const binsCreateInfo = [{
                _id: new mongoose.Types.ObjectId().toString(),
                longitude: 145.1341923,
                latitude: -37.9119321,
                address: "Somewhere closer to campus centre",
                capacity: 200
            }];
            const binsUpdateInfo = [{
                _id: dummyDumbBins[2]._id.toString(),
                longitude: 0,
                latitude: 0,
                address: "A new address",
                capacity: 1
            }];
            const updateResult = await BinHelper.updateBins(binsDeleteInfo, binsCreateInfo, binsUpdateInfo, false);
            expect(updateResult).to.be.true;
            let deletedDummyDumbBin = await DumbBin.findById(dummyDumbBins[0]._id);
            expect(deletedDummyDumbBin).to.be.null;
            deletedDummyDumbBin = await DumbBin.findById(dummyDumbBins[1]._id);
            expect(deletedDummyDumbBin).to.be.null;
            const createdDummyDumbBin = await DumbBin.findById(binsCreateInfo[0]._id) as any;
            expect(createdDummyDumbBin?._id).to.be.deep.equal(new mongoose.Types.ObjectId(binsCreateInfo[0]._id));
            expect(createdDummyDumbBin?.location.coordinates[0]).to.equal(binsCreateInfo[0].longitude);
            expect(createdDummyDumbBin?.location.coordinates[1]).to.equal(binsCreateInfo[0].latitude);
            expect(createdDummyDumbBin?.address).to.equal(binsCreateInfo[0].address);
            expect(createdDummyDumbBin?.capacity).to.be.deep.equal(binsCreateInfo[0].capacity);
            expect(createdDummyDumbBin?.nearestSmartBin).to.be.undefined;
            const updatedDummyDumbBin = await DumbBin.findById(binsUpdateInfo[0]._id) as any;
            expect(updatedDummyDumbBin?._id).to.be.deep.equal(new mongoose.Types.ObjectId(binsUpdateInfo[0]._id));
            expect(updatedDummyDumbBin?.location.coordinates[0]).to.equal(binsUpdateInfo[0].longitude);
            expect(updatedDummyDumbBin?.location.coordinates[1]).to.equal(binsUpdateInfo[0].latitude);
            expect(updatedDummyDumbBin?.address).to.equal(binsUpdateInfo[0].address);
            expect(updatedDummyDumbBin?.capacity).to.deep.equal(binsUpdateInfo[0].capacity);
            expect(createdDummyDumbBin?.nearestSmartBin).to.be.undefined;
        });

        it("should fail to delete, create, and update all the specified dumb bin documents", async function() {
            const binsDeleteInfo = [dummyDumbBins[2]._id.toString()];
            const binsCreateInfo = [{
                _id: new mongoose.Types.ObjectId().toString(),
                longitude: -37.9119321,
                latitude: 145.1341923,
                address: "",
                capacity: -1
            }];
            const binsUpdateInfo = [{
                _id: dummyDumbBins[2]._id.toString(),
                longitude: -1000,
                latitude: 1000,
                address: "",
                capacity: 1000000,
                nearestSmartBin: dummySmartBins[0]._id
            }];
            const updateResult = BinHelper.updateBins(binsDeleteInfo, binsCreateInfo, binsUpdateInfo, false);
            expect(updateResult).to.eventually.be.false;
            // reveals that integrity has been maintained
            const deletedDummyDumbBin = await DumbBin.findById(dummyDumbBins[2]._id);
            expect(deletedDummyDumbBin).to.not.be.null;
            const createdDummyDumbBin = await DumbBin.findById(binsCreateInfo[0]._id) as any;
            expect(createdDummyDumbBin).to.be.null;
            const updatedDummyDumbBin = await DumbBin.findById(binsUpdateInfo[0]._id) as any;
            expect(updatedDummyDumbBin?._id).to.deep.equal(new mongoose.Types.ObjectId(binsUpdateInfo[0]._id));
            expect(updatedDummyDumbBin?.location.coordinates[0]).to.not.equal(binsUpdateInfo[0].longitude);
            expect(updatedDummyDumbBin?.location.coordinates[1]).to.not.equal(binsUpdateInfo[0].latitude);
            expect(updatedDummyDumbBin?.address).to.not.equal(binsUpdateInfo[0].address);
            expect(updatedDummyDumbBin?.capacity).to.not.deep.equal(binsUpdateInfo[0].capacity);
            expect(createdDummyDumbBin?.nearestSmartBin).to.be.undefined;
        });
    });

    // Smart bins update are not included as based on our assumption they are all based on the data from the 
    // remote database which is assumed to be in the correct format as user cannot directly interact with our 
    // application using this function to manipulate smart bins
});
