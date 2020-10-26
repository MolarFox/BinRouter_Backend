import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import SmartBinFillLevel from "../smart-bin-fill-level";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("SmartBinFillLevel", function() {
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
        it("should successfully create a new smart bin fill level document in SmartBinFillLevels collection", async function() {
            const smartBinFillLevelDoc = {
                _id: new mongoose.Types.ObjectId(),
                serialNumber: 123456789,
                fullness: 10, 
                timestamp: new Date()
            };
            await SmartBinFillLevel.create(smartBinFillLevelDoc);
            const actualResult = await SmartBinFillLevel.findById(smartBinFillLevelDoc._id) as any;
            expect(actualResult).to.be.not.null;
            expect(actualResult?._id).to.deep.equal(smartBinFillLevelDoc._id);
            expect(actualResult?.serialNumber).to.equal(smartBinFillLevelDoc.serialNumber);
            expect(actualResult?.fullness).to.equal(smartBinFillLevelDoc.fullness);
            expect(actualResult?.timestamp).to.deep.equal(smartBinFillLevelDoc.timestamp);
            await SmartBinFillLevel.findByIdAndDelete(smartBinFillLevelDoc._id);
        });

        it("should fail to create a new smart bin fill level document in SmartBinFillLevels collection", async function() {
            const smartBinFillLevelDoc = {
                _id: new mongoose.Types.ObjectId(),
                serialNumber: true,
                fullness: -10, 
                timestamp: undefined
            };
            expect(SmartBinFillLevel.create(smartBinFillLevelDoc)).to.be.rejectedWith(mongoose.Error.ValidationError);
            const actualResult = await SmartBinFillLevel.findById(smartBinFillLevelDoc._id);
            expect(actualResult).to.be.null;
        });
    });
});
