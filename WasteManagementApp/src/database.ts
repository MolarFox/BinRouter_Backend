import mongoose from "mongoose";
import { Logger } from "./utils/logger";

export default class Database {
    private static connection: null | mongoose.Connection = null;

    private constructor() {}

    public static async connect(): Promise<mongoose.Connection> {
        if (Database.connection) {
            return Promise.resolve(Database.connection);
        } else {
            return new Promise((resolve, reject) => {
                Logger.log("Start connecting to the database...", "\n");
                mongoose.connect(
                    "mongodb://" + process.env.DB_HOST + ":" + process.env.DB_PORT + "/" + process.env.DB_NAME,
                    {
                        useCreateIndex: true,
                        useNewUrlParser: true,
                        useUnifiedTopology: true,
                        poolSize: 10,
                    }
                ).catch(error => Logger.error("Initial connection error: ", error, "\n"));
                mongoose.connection.on("error", (error) => {
                    Logger.error("Connection error: ", error, "\n");
                    reject(error);
                });
                mongoose.connection.once("open", function() {
                    Logger.log("A connection to the database has been successfully established", "\n");
                    Database.connection = mongoose.connection;
                    resolve(mongoose.connection);
                });
            });
        }
    }
}
