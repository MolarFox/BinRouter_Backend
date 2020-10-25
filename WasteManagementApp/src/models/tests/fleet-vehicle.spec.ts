import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import FleetVehicle from "../fleet-vehicle";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("FleetVehicle", function() {
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
        it("should successfully create a new fleet vehicle document in FleetVehicles collection", async function() {
            const fleetVehicleDoc = {
                _id: new mongoose.Types.ObjectId(),
                rego: "ZZZZZZ",
                capacity: 10000,
                available: true,
                icon: 1,
                homeDepot: new mongoose.Types.ObjectId()
            };
            await FleetVehicle.findOneAndDelete({
                rego: "ZZZZZZ"
            });
            await FleetVehicle.create(fleetVehicleDoc);
            const actualResult = await FleetVehicle.findOne(fleetVehicleDoc) as any;
            expect(actualResult?._id).to.deep.equal(fleetVehicleDoc._id);
            expect(actualResult?.rego).to.equal(fleetVehicleDoc.rego);
            expect(actualResult?.capacity).to.equal(fleetVehicleDoc.capacity);
            expect(actualResult?.available).to.equal(fleetVehicleDoc.available);
            expect(actualResult?.icon).to.deep.equal(fleetVehicleDoc.icon);
            expect(actualResult?.homeDepot).to.be.deep.equal(fleetVehicleDoc.homeDepot);
            await FleetVehicle.findByIdAndDelete(fleetVehicleDoc._id);
        });

        it("should fail to create a new fleet vehicle document in FleetVehicles collection", function() {
            const fleetVehicleDoc = {
                _id: new mongoose.Types.ObjectId(),
                rego: "ZZZZZZ",
                capacity: 0, 
                available: "not a boolean",
                icon: -1
            };
            expect(FleetVehicle.create(fleetVehicleDoc)).to.be.rejectedWith(mongoose.Error.ValidationError);
        });
    });
});
