import { expect } from "chai";
import mongoose from "mongoose";
import { BinHelper } from "../bin-helper";

describe("BinHelper", function() {
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
});
