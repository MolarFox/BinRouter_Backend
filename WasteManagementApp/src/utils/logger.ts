/**
 * Author name: Yisong Yu
 * Last modified date: October 24, 2020
 * Description: 
 * This source code file includes all the logging-related functions grouped in the class named Logger that is 
 * not intended to be instantiated. It provides the functionality of logging both general messages as well as 
 * errors, in either normal mode (i.e., to both the console and the log file) or verbose mode (i.e., to only 
 * the log file), and logging performance metrics and details of incoming HTTP requests to their corresponding 
 * log files as well. This utility is mainly used for improving maintainability and traceability of the history
 * for administration purpose.
 */

import fs from "fs";
import path from "path";
import util from "util";
import { Console } from "console";
import { INCOMING_REQUEST_LOG_FILENAME, LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_ERROR_FILENAME, SYSTEM_LOG_FILENAME, SYSTEM_PERFORMANCE_LOG_FILENAME } from "../constants/misc";

export class Logger {
    // generalConsole is used to log general messages and errors
    private static generalConsole: Console;
    // performanceConsole us used to log performance metrics
    private static performanceConsole: Console;
    // incomingRequestConsole is used to log details of incoming HTTP requests
    private static incomingRequestConsole: Console;

    /**
     * Prevent others from instantiating this class
     */
    private constructor() {}

    /**
     * Initialise all the consoles with their corresponding output file streams to be used for logging
     * 
     * @returns {void}
     */
    public static initialise() {
        // Only initialise all the consoles once
        if (!Logger.generalConsole || !Logger.performanceConsole || !Logger.incomingRequestConsole) {
            // Check whether the log directory exists
            const logDirectoryExisted = fs.existsSync(LOG_DIRECTORY_RELATIVE_PATH);
            // If it doesn't exist, create one
            if (!logDirectoryExisted) {
                fs.mkdirSync(LOG_DIRECTORY_RELATIVE_PATH, {
                    recursive: true,
                });
            }

            const systemLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_LOG_FILENAME);
            // Check whether the general log file exists
            const systemLogFileExisted = fs.existsSync(systemLogFilePath);
            // If it doesn't exist, create one
            if (!systemLogFileExisted) {
                fs.closeSync(fs.openSync(systemLogFilePath, "w"));
            }

            const systemErrorFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_ERROR_FILENAME);
            // Check whether the error log file exists
            const systemErrorFileExisted = fs.existsSync(systemErrorFilePath);
            // If it doesn't exist, create one
            if (!systemErrorFileExisted) {
                fs.closeSync(fs.openSync(systemErrorFilePath, "w"));
            }

            const systemPerformanceLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_PERFORMANCE_LOG_FILENAME);
            // Check whether the performance log file exists
            const systemPerformanceLogFileExisted = fs.existsSync(systemPerformanceLogFilePath);
            // If it doesn't exist, create one
            if (!systemPerformanceLogFileExisted) {
                fs.closeSync(fs.openSync(systemPerformanceLogFilePath, "w"));
            }

            const incomingRequestLogFilePath = path.resolve(LOG_DIRECTORY_RELATIVE_PATH, INCOMING_REQUEST_LOG_FILENAME);
            // Check whether the incoming HTTP request log file exists
            const incomingRequestLogFileExisted = fs.existsSync(incomingRequestLogFilePath);
            // If it doesn't exist, create one
            if (!incomingRequestLogFileExisted) {
                fs.closeSync(fs.openSync(incomingRequestLogFilePath, "w"));
            }

            // Create a new Console with a writable stream instance created from the general log file to be used as the standard
            // output, and a writable stream instance created from the error log file to be used as the standard error output
            Logger.generalConsole = new Console({
                stdout: fs.createWriteStream(systemLogFilePath),
                stderr: fs.createWriteStream(systemErrorFilePath),
            });
            // Create a new Console with a writable stream instance created from the performance log file to be used as the 
            // standard output
            Logger.performanceConsole = new Console({
                stdout: fs.createWriteStream(systemPerformanceLogFilePath)
            });
            // Create a new Console with a writable stream instance created from the incoming HTTP request log file to be used 
            // as the standard output
            Logger.incomingRequestConsole = new Console({
                stdout: fs.createWriteStream(incomingRequestLogFilePath)
            });
        }
    }

    /**
     * Get the string representation of the input object by expanding all of its properties, and for any other input type, 
     * this function simply returns the original input
     * 
     * @param {any} object any valid JavaScript object
     * 
     * @returns {any} the string representation of the input object or the input itself if it is not a valid JavaScript object
     */
    private static stringify(object: any): any {
        return typeof object === "object" ? util.inspect(object, false, null) : object;
    }

    /**
     * Log the input messages to only the general log file
     * 
     * @param {any} message any value
     * @param {any} optionalParams any value
     * 
     * @returns {void}
     */
    public static verboseLog(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.generalConsole) {
            Logger.generalConsole.log(message, ...optionalParams);
        }
    }

    /**
     * Log the input messages to both the console and the general log file
     * 
     * @param {any} message any value
     * @param {any} optionalParams any value
     * 
     * @returns {void}
     */
    public static log(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        console.log(message, ...optionalParams);
        if (Logger.generalConsole) {
            Logger.generalConsole.log(message, ...optionalParams);
        }
    }

    /**
     * Log the input messages to only the error log file
     * 
     * @param {any} message any value
     * @param {any} optionalParams any value
     * 
     * @returns {void}
     */
    public static verboseError(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.generalConsole) {
            Logger.generalConsole.error(message, ...optionalParams);
        }
    }

    /**
     * Log the input messages to both the console and the error log file
     * 
     * @param {any} message any value
     * @param {any} optionalParams any value
     * 
     * @returns {void}
     */
    public static error(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        console.error(message, ...optionalParams);
        if (Logger.generalConsole) {
            Logger.generalConsole.error(message, ...optionalParams);
        }
    }

    /**
     * Log the input messages to only the performance log file
     * 
     * @param {any} message any value
     * @param {any} optionalParams any value
     * 
     * @returns {void}
     */
    public static logPerformance(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.performanceConsole) {
            Logger.performanceConsole.log(message, ...optionalParams);
        }
    }

    /**
     * Log the input messages to only the incoming HTTP request log file
     * 
     * @param {any} message any value
     * @param {any} optionalParams any value
     * 
     * @returns {void}
     */
    public static logRequest(message?: any, ...optionalParams: any[]) {
        message = Logger.stringify(message);
        optionalParams = optionalParams.map(Logger.stringify);
        if (Logger.incomingRequestConsole) {
            Logger.incomingRequestConsole.log(message, ...optionalParams);
        }
    }
}
