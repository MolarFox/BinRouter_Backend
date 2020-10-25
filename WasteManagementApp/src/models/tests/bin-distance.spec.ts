import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import BinDistance from "../bin-distance";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("BinDistance", function() {
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
        it("should successfully create a new bin distance document in BinDistances collection", async function() {
            const binDistanceDoc = {
                _id: new mongoose.Types.ObjectId(),
                origin: new mongoose.Types.ObjectId(),
                originType: "DumbBin",
                destination: new mongoose.Types.ObjectId(),
                destinationType: "SmartBin",
                distance: 10000,
                duration: 12345
            };
            await BinDistance.create(binDistanceDoc);
            const actualResult = await BinDistance.findOne(binDistanceDoc) as any;
            expect(actualResult?._id).to.deep.equal(binDistanceDoc._id);
            expect(actualResult?.origin).to.deep.equal(binDistanceDoc.origin);
            expect(actualResult?.originType).to.equal(binDistanceDoc.originType);
            expect(actualResult?.destination).to.deep.equal(binDistanceDoc.destination);
            expect(actualResult?.destinationType).to.equal(binDistanceDoc.destinationType);
            expect(actualResult?.distance).to.equal(binDistanceDoc.distance);
            expect(actualResult?.duration).to.equal(binDistanceDoc.duration);
            await BinDistance.findByIdAndDelete(binDistanceDoc._id);
        });

        it("should fail to create a new bin distance document in BinDistances collection", function() {
            const binDistanceDoc = {
                _id: new mongoose.Types.ObjectId(),
                origin: undefined,
                originType: "Something",
                destination: undefined,
                destinationType: "Something Else",
                distance: "Not a Number",
                duration: true
            };
            expect(BinDistance.create(binDistanceDoc)).to.be.rejectedWith(mongoose.Error.ValidationError);
        });
    });
});
