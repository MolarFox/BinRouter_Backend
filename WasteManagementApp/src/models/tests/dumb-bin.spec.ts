import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import DumbBin from "../dumb-bin";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("DumbBin", function() {
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
        it("should successfully create a new dumb bin document in DumbBins collection", async function() {
            const dumbBinDoc = {
                _id: new mongoose.Types.ObjectId(),
                location: {
                    type: "Point",
                    coordinates: [145.045837, -37.876823]
                },
                address: "Monash University, 900 Dandenong Rd, Caulfield East VIC 3145",
                capacity: 1000,
                nearestSmartBin: new mongoose.Types.ObjectId()
            };
            await DumbBin.create(dumbBinDoc) as any;
            const actualResult = await DumbBin.findOne(dumbBinDoc) as any;
            expect(actualResult?._id).to.deep.equal(dumbBinDoc._id);
            expect(actualResult?.location.type).to.equal(dumbBinDoc.location.type);
            expect(actualResult?.location.coordinates).to.deep.equal(dumbBinDoc.location.coordinates);
            expect(actualResult?.address).to.equal(dumbBinDoc.address);
            expect(actualResult?.capacity).to.equal(dumbBinDoc.capacity);
            expect(actualResult?.nearestSmartBin).to.deep.equal(dumbBinDoc.nearestSmartBin);
            await DumbBin.findByIdAndDelete(dumbBinDoc._id);
        });

        it("should fail to create a new dumb bin document in DumbBins collection", function() {
            const dumbBinDoc = {
                _id: new mongoose.Types.ObjectId(),
                location: {
                    type: "LineString",
                    coordinates: [-37.876823, 145.045837]
                },
                address: undefined,
                capacity: -1
            };
            expect(DumbBin.create(dumbBinDoc)).to.be.rejectedWith(mongoose.Error.ValidationError);
        });
    });
});
