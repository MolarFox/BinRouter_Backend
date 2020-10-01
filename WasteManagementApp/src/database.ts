import mongoose from "mongoose";

export default class Database {
    private static connection: null | mongoose.Connection = null;

    private constructor() {}

    public static async connect(): Promise<mongoose.Connection> {
        if (Database.connection) {
            return Promise.resolve(Database.connection);
        } else {
            return new Promise((resolve, reject) => {
                console.log("Start connecting to the database...");
                mongoose.connect(
                    "mongodb://" + process.env.DB_HOST + ":" + process.env.DB_PORT + "/" + process.env.DB_NAME,
                    {
                        useCreateIndex: true,
                        useNewUrlParser: true,
                        useUnifiedTopology: true,
                        poolSize: 10,
                    }
                ).catch(console.error.bind(console, "Initial connection error: "));
                mongoose.connection.on("error", function(error) {
                    console.error("Connection error: ", error);
                    reject(error);
                });
                mongoose.connection.once("open", function() {
                    console.log("A connection to the database is successfully established");
                    Database.connection = mongoose.connection;
                    resolve(mongoose.connection);
                });
            });
        }
    }
}