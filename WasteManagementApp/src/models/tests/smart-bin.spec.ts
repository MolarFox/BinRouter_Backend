import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import SmartBin from "../smart-bin";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("SmartBin", function() {
    let connection: mongoose.Connection | undefined;

    before("connect to the database", async function() {
        process.env.DB_HOST="localhost";
        process.env.DB_PORT="27017";
        process.env.DB_NAME="WasteManagementDB";
        connection = await Database.connect();
    });

    after("disconnect from the database", async function() {
        await connection?.close();
    });

    describe("#create", function() {
        it("should successfully create a new smart bin document in SmartBins collection", async function() {
            const smartBinDoc = {
                _id: new mongoose.Types.ObjectId(),
                serialNumber: 123456789,
                location: {
                    type: "Point",
                    coordinates: [144.9624, -37.8105]
                },
                address: "Melbourne Central, Cnr La Trobe St &, Swanston St, Melbourne VIC 3000",
                capacity: 1000,
                threshold: 8,
                currentFullness: 6, 
                lastUpdated: new Date()
            };
            await SmartBin.findOneAndDelete({
                serialNumber: 123456789
            });
            await SmartBin.create(smartBinDoc);
            const actualResult = await SmartBin.findOne(smartBinDoc) as any;
            expect(actualResult?._id).to.deep.equal(smartBinDoc._id);
            expect(actualResult?.location.type).to.equal(smartBinDoc.location.type);
            expect(actualResult?.location.coordinates).to.deep.equal(smartBinDoc.location.coordinates);
            expect(actualResult?.address).to.equal(smartBinDoc.address);
            expect(actualResult?.capacity).to.equal(smartBinDoc.capacity);
            expect(actualResult?.threshold).to.equal(smartBinDoc.threshold);
            expect(actualResult?.currentFullness).to.equal(smartBinDoc.currentFullness);
            expect(actualResult?.lastUpdated).to.deep.equal(smartBinDoc.lastUpdated);
            await SmartBin.findByIdAndDelete(smartBinDoc._id);
        });

        it("should fail to create a new smart bin document in SmartBins collection", function() {
            const smartBinDoc = {
                _id: new mongoose.Types.ObjectId(),
                serialNumber: undefined,
                location: {
                    type: "MultiPoint",
                    coordinates: [-37.8105, 144.9624]
                },
                address: undefined,
                capacity: -1000,
                threshold: -1,
                currentFullness: -1, 
                lastUpdated: "some random value"
            };
            expect(SmartBin.create(smartBinDoc)).to.be.rejectedWith(mongoose.Error.ValidationError);
        });
    });
});
