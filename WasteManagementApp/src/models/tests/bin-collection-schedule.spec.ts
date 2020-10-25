import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import mongoose from "mongoose";
import { Database } from "../../database";
import BinCollectionSchedule from "../bin-collection-schedule";
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("BinCollectionSchedule", function() {
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
        it("should successfully create a new bin collection schedule document in BinCollectionSchedules collection", async function() {
            const binCollectionScheduleDoc = {
                _id: new mongoose.Types.ObjectId(),
                routes: [
                    {
                        vehicle: new mongoose.Types.ObjectId(), 
                        visitingOrder: [
                            {
                                longitude: -180,
                                latitude: -90
                            },
                            {
                                longitude: 180,
                                latitude: 90
                            },
                            {
                                longitude: 0,
                                latitude: 0
                            }
                        ]
                    },
                    {
                        vehicle: new mongoose.Types.ObjectId(),
                        visitingOrder: []
                    }
                ],
                timestamp: new Date()
            };
            await BinCollectionSchedule.create(binCollectionScheduleDoc);
            const actualResult = await BinCollectionSchedule.findOne(binCollectionScheduleDoc) as any;
            expect(actualResult?._id).to.deep.equal(binCollectionScheduleDoc._id);
            for (let i = 0; i < binCollectionScheduleDoc.routes.length; i++) {
                expect(actualResult?.routes[i].vehicle).to.deep.equal(binCollectionScheduleDoc.routes[i].vehicle);
                for (let j = 0; j < binCollectionScheduleDoc.routes[i].visitingOrder.length; j++) {
                    expect(actualResult?.routes[i].visitingOrder[j].longitude)
                        .to.equal(binCollectionScheduleDoc.routes[i].visitingOrder[j].longitude);
                    expect(actualResult?.routes[i].visitingOrder[j].latitude)
                        .to.equal(binCollectionScheduleDoc.routes[i].visitingOrder[j].latitude);
                }
            }
            expect(actualResult?.timestamp).to.deep.equal(binCollectionScheduleDoc.timestamp);
            await BinCollectionSchedule.findByIdAndDelete(binCollectionScheduleDoc._id);
        });

        it("should fail to create a new bin collection schedule document in BinCollectionSchedules collection", function() {
            const binCollectionScheduleDoc = {
                _id: new mongoose.Types.ObjectId(),
                routes: [
                    {
                        vehicle: new mongoose.Types.ObjectId(), 
                        visitingOrder: [{}, {}]
                    },
                    {
                        vehicle: new mongoose.Types.ObjectId(),
                        visitingOrder: [
                            {
                                longitude: -181,
                                latitude: -91
                            },
                            {
                                longitude: 181,
                                latitude: 91
                            }
                        ]
                    }
                ],
                timestamp: false
            };
            expect(BinCollectionSchedule.create(binCollectionScheduleDoc)).to.be.rejectedWith(mongoose.Error.ValidationError);
        });
    });
});
