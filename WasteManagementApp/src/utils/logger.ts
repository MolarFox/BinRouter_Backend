import fs from "fs";
import path from "path";
import util from "util";
import { Console } from "console";
import { INCOMING_REQUEST_LOG_FILENAME, LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_ERROR_FILENAME, SYSTEM_LOG_FILENAME, SYSTEM_PERFORMANCE_LOG_FILENAME } from "../constants/misc";

export class Logger {
    private static generalConsole: Console;
    private static performanceConsole: Console;
    private static incomingRequestConsole: Console;

    public static initialise() {
        if (!Logger.generalConsole) {
            const logDirectoryExisted = fs.existsSync(LOG_DIRECTORY_RELATIVE_PATH);
            if (!logDirectoryExisted) {
                fs.mkdirSync(LOG_DIRECTORY_RELATIVE_PATH, {
                    recursive: true,
                });
            }

            const systemLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_LOG_FILENAME);
            const systemLogFileExisted = fs.existsSync(systemLogFilePath);
            if (!systemLogFileExisted) {
                fs.closeSync(fs.openSync(systemLogFilePath, "w"));
            }

            const systemErrorFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_ERROR_FILENAME);
            const systemErrorFileExisted = fs.existsSync(systemErrorFilePath);
            if (!systemErrorFileExisted) {
                fs.closeSync(fs.openSync(systemErrorFilePath, "w"));
            }

            const systemPerformanceLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_PERFORMANCE_LOG_FILENAME);
            const systemPerformanceLogFileExisted = fs.existsSync(systemPerformanceLogFilePath);
            if (!systemPerformanceLogFileExisted) {
                fs.closeSync(fs.openSync(systemPerformanceLogFilePath, "w"));
            }

            const incomingRequestLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, INCOMING_REQUEST_LOG_FILENAME);
            const incomingRequestLogFileExisted = fs.existsSync(incomingRequestLogFilePath);
            if (!incomingRequestLogFileExisted) {
                fs.closeSync(fs.openSync(incomingRequestLogFilePath, "w"));
            }

            Logger.generalConsole = new Console({
                stdout: fs.createWriteStream(systemLogFilePath),
                stderr: fs.createWriteStream(systemErrorFilePath),
            });
            Logger.performanceConsole = new Console({
                stdout: fs.createWriteStream(systemPerformanceLogFilePath)
            });
            Logger.incomingRequestConsole = new Console({
                stdout: fs.createWriteStream(incomingRequestLogFilePath)
            });
        }
    }

    private static stringify(object: any) {
        return typeof object === "object" ? util.inspect(object, false, null) : object;
    }

    public static verboseLog(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.generalConsole) {
            Logger.generalConsole.log(message, ...optionalParams);
        }
    }

    public static log(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        console.log(message, ...optionalParams);
        if (Logger.generalConsole) {
            Logger.generalConsole.log(message, ...optionalParams);
        }
    }

    public static verboseError(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.generalConsole) {
            Logger.generalConsole.error(message, ...optionalParams);
        }
    }

    public static error(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        console.error(message, ...optionalParams);
        if (Logger.generalConsole) {
            Logger.generalConsole.error(message, ...optionalParams);
        }
    }

    public static logPerformance(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.performanceConsole) {
            Logger.performanceConsole.log(message, ...optionalParams);
        }
    }

    public static logRequest(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.incomingRequestConsole) {
            Logger.incomingRequestConsole.log(message, ...optionalParams);
        }
    }
}
