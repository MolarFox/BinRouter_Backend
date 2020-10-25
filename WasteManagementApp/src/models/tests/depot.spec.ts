import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import Depot from "../depot";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Depot", function() {
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
        it("should successfully create a new depot document in Depots collection", async function() {
            const depotDoc = {
                _id: new mongoose.Types.ObjectId(),
                location: {
                    type: "Point",
                    coordinates: [145.133957, -37.907803]
                },
                address: "Monash University, Wellington Rd, Clayton VIC 3800"
            };
            await Depot.create(depotDoc);
            const actualResult = await Depot.findOne(depotDoc) as any;
            expect(actualResult?._id).to.deep.equal(depotDoc._id);
            expect(actualResult?.location.type).to.equal(depotDoc.location.type);
            expect(actualResult?.location.coordinates).to.deep.equal(depotDoc.location.coordinates);
            expect(actualResult?.address).to.equal(depotDoc.address);
            await Depot.findByIdAndDelete(depotDoc._id);
        });

        it("should fail to create a new depot document in Depots collection", function() {
            const depotDoc = {
                _id: new mongoose.Types.ObjectId(),
                location: {
                    type: "Polygon",
                    coordinates: [-37.907803, 145.133957]
                },
                address: ""
            };
            expect(Depot.create(depotDoc)).to.be.rejectedWith(mongoose.Error.ValidationError);
        });
    });
});
