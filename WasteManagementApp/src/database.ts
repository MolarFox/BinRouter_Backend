/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes all the database connection-related functions grouped in the class named Database
 * that is intended to be instantiated and used as a wrapper to hide the connection details. It provides the 
 * functionality of connecting to a backend database asynchronously.
 */

import mongoose from "mongoose";
import { Logger } from "./utils/logger";

export default class Database {
    // connection stores a handle to a mongoose connection
    private static connection: null | mongoose.Connection = null;

    /**
     * Prevent others from instantiating this class
     */
    private constructor() {}

    /**
     * Connect to the backend MongoDB
     * 
     * @async
     * 
     * @returns {mongoose.Connection} a mongoose connection instance
     */
    public static async connect(): Promise<mongoose.Connection> {
        // If a connection has already been opened, use it to prevent multiple connections from being opened, which might 
        // slow down the entire application and processing speed
        if (Database.connection) {
            return Promise.resolve(Database.connection);
        } else {
            return new Promise((resolve, reject) => {
                Logger.log("Start connecting to the database...", "\n");
                // Attempt to connect to the backend MongoDB with the specified URL, with 10 sockets opened to allow 
                // more queries to be executed in parallel simultaneously
                mongoose.connect(
                    "mongodb://" + process.env.DB_HOST + ":" + process.env.DB_PORT + "/" + process.env.DB_NAME,
                    {
                        useCreateIndex: true,
                        useNewUrlParser: true,
                        useUnifiedTopology: true,
                        poolSize: 10,
                    }
                ).catch(error => Logger.error("Initial connection error: ", error, "\n"));
                // This callback will be invoked when there's an error encountered when attempting to connect to the backend MongoDB
                mongoose.connection.on("error", (error) => {
                    Logger.error("Connection error: ", error, "\n");
                    reject(error);
                });
                // This callback will be invoked once a connection has been opened
                mongoose.connection.once("open", function() {
                    Logger.log("A connection to the database has been successfully established", "\n");
                    Database.connection = mongoose.connection;
                    resolve(mongoose.connection);
                });
            });
        }
    }
}
