import fs from "fs";
import path from "path";
import { Console } from "console";
import { LOG_DIRECTORY_RELATIVE_PATH, SYSTEM_ERROR_FILENAME, SYSTEM_LOG_FILENAME } from "../constants/misc";

export class Logger {
    private static customConsole: Console;

    public static initialise() {
        if (!Logger.customConsole) {
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
            
            Logger.customConsole = new Console(
                fs.createWriteStream(systemLogFilePath),
                fs.createWriteStream(systemErrorFilePath)
            );
        }
    }

    public static log(message?: any, ...optionalParams: any[]) {
        console.log(message, ...optionalParams);
        if (Logger.customConsole) {
            Logger.customConsole.log(message, ...optionalParams);
        }
    }

    public static error(message?: any, ...optionalParams: any[]) {
        console.error(message, ...optionalParams);
        if (Logger.customConsole) {
            Logger.customConsole.error(message, ...optionalParams);
        }
    }
}
