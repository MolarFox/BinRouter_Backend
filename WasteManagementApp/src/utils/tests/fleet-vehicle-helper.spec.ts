import { expect } from "chai";
import mongoose from "mongoose";
import { FleetVehicleHelper } from "../fleet-vehicle-helper";

describe("FleetVehicleHelper", function() {
    describe("#verifyFleetVehicleDeleteInfo", function() {
        it("should return true", function() {
            let actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo("111111111111");
            expect(actualResult).to.be.true;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo(new mongoose.Types.ObjectId().toString());
            expect(actualResult).to.be.true;
        });

        it("should return false", function() {
            let actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo(undefined);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo(null);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo({x: 1});
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo(100);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo(new Date());
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo(false);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo("123456789");
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo("123456789123456789123456789123456789");
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleDeleteInfo(new mongoose.Types.ObjectId());
            expect(actualResult).to.be.false;
        });
    });

    describe("#verifyFleetVehicleCreateInfo", function() {
        it("should return true", function() {
            let actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo({
                rego: "AAAAAA",
                capacity: 1,
                available: true,
                icon: 0
            });
            expect(actualResult).to.be.true;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo({
                rego: "ZZZZZZ",
                capacity: 50000,
                available: false,
                icon: 11,
                homeDepot: new mongoose.Types.ObjectId().toString(),
                somethingExtra: "Extra stuff",
            });
            expect(actualResult).to.be.true;
        });
        
        it("should return false", function() {
            let actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo(undefined);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo(null);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo("x");
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo(100);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo(new Date());
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo(false);
            expect(actualResult).to.be.false;
            
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo({
                rego: "",
                capacity: 100,
                available: true,
                icon: 0
            });
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo({
                rego: "ABCDEF",
                capacity: 0,
                available: false,
                icon: 11
            });
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo({
                rego: "ABCDEF",
                capacity: 100,
                available: false,
                icon: 12
            });
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleCreateInfo({
                rego: "ZZZZZZ",
                capacity: 1,
                available: true,
                icon: 0,
                homeDepot: false
            });
            expect(actualResult).to.be.false;
        });
    });

    describe("#verifyFleetVehicleUpdateInfo", function() {
        it("should return true", function() {
            let actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                rego: "AAAAAA",
                capacity: 1,
                available: true,
                icon: 0
            });
            expect(actualResult).to.be.true;
            // One potential defect we identified
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                rego: "ZZZZZZ",
                capacity: 50000,
                available: false,
                icon: 11,
                homeDepot: new mongoose.Types.ObjectId().toString(),
                somethingExtra: null
            });
            expect(actualResult).to.be.true;
        });
        
        it("should return false", function() {
            let actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo(undefined);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo(null);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo("x");
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo(100);
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo(new Date());
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo(false);
            expect(actualResult).to.be.false;
            
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                rego: "",
                capacity: 100,
                available: true,
                icon: 0
            });
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                rego: "ABCDEF",
                capacity: 0,
                available: false,
                icon: 11
            });
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                rego: "ABCDEF",
                capacity: 100,
                available: false,
                icon: 12
            });
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo({
                _id: new mongoose.Types.ObjectId(),
                rego: "ZZZZZZ",
                capacity: 1,
                available: true,
                icon: 0,
                homeDepot: false
            });
            expect(actualResult).to.be.false;
            actualResult = FleetVehicleHelper.verifyFleetVehicleUpdateInfo({
                _id: "Invalid ID",
                rego: "ZZZZZZ",
                capacity: 1,
                available: true,
                icon: 0
            });
            expect(actualResult).to.be.false;
        });
    });
});
