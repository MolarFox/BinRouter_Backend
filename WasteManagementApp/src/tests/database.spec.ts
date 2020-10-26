import { expect } from "chai";
import { Database } from "../database";

describe("Database", function() {
    before("initialise the environment", function() {
        process.env.DB_HOST="localhost";
        process.env.DB_PORT="27017";
        process.env.DB_NAME="WasteManagementDB";
    });

    describe("#connect", function() {
        it("should return a connection", async function() {
            const connection = await Database.connect();
            expect(connection).to.not.be.null.and.not.be.undefined;
            expect(connection.readyState).to.equal(connection.states.connected);
            await connection.close();
            expect(connection.readyState).to.equal(connection.states.disconnected);
        });
    });
});
