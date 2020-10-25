import { expect } from "chai";
import fs from "fs";
import path from "path";
import { Logger } from "../logger";
import { INCOMING_REQUEST_LOG_FILENAME, LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_ERROR_FILENAME, SYSTEM_LOG_FILENAME, SYSTEM_PERFORMANCE_LOG_FILENAME } from "../../constants/misc";

describe("Logger", function() {
    before("initialise the logger", function() {
        Logger.initialise();
    });

    describe("#initialise", function() {
        it("should have created the log directory and files", function() {
            const logDirectoryExisted = fs.existsSync(LOG_DIRECTORY_RELATIVE_PATH);

            const systemLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_LOG_FILENAME);
            const systemLogFileExisted = fs.existsSync(systemLogFilePath);

            const systemErrorFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_ERROR_FILENAME);
            const systemErrorFileExisted = fs.existsSync(systemErrorFilePath);

            const systemPerformanceLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_PERFORMANCE_LOG_FILENAME);
            const systemPerformanceLogFileExisted = fs.existsSync(systemPerformanceLogFilePath);

            const incomingRequestLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, INCOMING_REQUEST_LOG_FILENAME);
            const incomingRequestLogFileExisted = fs.existsSync(incomingRequestLogFilePath);

            expect(logDirectoryExisted).to.be.true;
            expect(systemLogFileExisted).to.be.true;
            expect(systemErrorFileExisted).to.be.true;
            expect(systemPerformanceLogFileExisted).to.be.true;
            expect(incomingRequestLogFileExisted).to.be.true;
        });
    });

    describe("#verboseLog", function() {
        it("should write to system_log.log", function() {
            Logger.verboseLog("Hello ", "this is the first test");
            Logger.verboseLog({x: 1, y: 1});
        });
    });

    describe("#verboseError", function() {
        it("should write to system_log.log", function() {
            Logger.verboseError("Hello ", "this is the second test");
            Logger.verboseError({x: 2, y: 2});
        });
    });

    describe("#logPerformance", function() {
        it("should write to system_performance_log.log", function() {
            Logger.logPerformance("Hello ", "this is the third test");
            Logger.logPerformance({x: 3, y: 3});
        });
    });

    describe("#logRequest", function() {
        it("should write to incoming_request_log.log", function() {
            Logger.logRequest("Hello ", "this is the fourth test");
            Logger.logRequest({x: 4, y: 4});
        });
    });
});
