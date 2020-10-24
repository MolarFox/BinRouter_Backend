import mongoose from "mongoose";
import { COMPUTE_NEAREST_SMART_BINS_LOG_TAG, UPDATE_BINS_LOG_TAG, UPDATE_NEAREST_SMART_BINS_LOG_TAG } from "../constants/log-tag";
import { BIN_SEARCH_DISTANCE } from "../constants/misc";
import DumbBin from "../models/dumb-bin";
import SmartBin from "../models/smart-bin";
import { Logger } from "./logger";
import { BinCreateInfo, BinDeleteInfo, BinUpdateInfo, IdLatLng, LatLng } from "./type-information";

export class BinHelper {
    /**
     * Prevent others from instantiating this class
     */
    private constructor() {}

    /**
     * Verify whether the input dumb bin's delete-related information is valid to be used in the database 
     * delete operation or not
     * 
     * @param {any} dumbBinDeleteInfo any value
     * 
     * @returns {boolean} true if the input argument is valid, false otherwise
     */
    public static verifyDumbBinDeleteInfo(dumbBinDeleteInfo: any): boolean {
        return typeof dumbBinDeleteInfo === "string" && mongoose.Types.ObjectId.isValid(dumbBinDeleteInfo);
    }

    /**
     * Verify whether the input dumb bin's create-related information is valid to be used in the database 
     * create operation or not
     * 
     * @param {any} dumbBinCreateInfo any value
     * 
     * @returns {boolean} true if the input argument is valid, false otherwise
     */
    public static verifyDumbBinCreateInfo(dumbBinCreateInfo: any): boolean {
        // The first condition (i.e., !dumbBinCreateInfo) is to check whether the input argument is null or 
        // not as typeof null will return "object" as well
        if (!dumbBinCreateInfo || typeof dumbBinCreateInfo !== "object") {
            return false;
        }

        const dumbBinCreateInfoCorePropertiesTypes: {
            [property: string]: string
        } = {
            longitude: "number",
            latitude: "number",
            address: "string",
            capacity: "number",
        }
        // Check whether the input argument is an object containing the core properties with corresponding value types
        // specified above in dumbBinCreateInfoCorePropertiesTypes
        const dumbBinCreateInfoCorePropertiesTypesCheckResult =
            Object
                .keys(dumbBinCreateInfoCorePropertiesTypes)
                .map(property => typeof dumbBinCreateInfo[property] === dumbBinCreateInfoCorePropertiesTypes[property])
                .every(isMatched => isMatched);

        if (!dumbBinCreateInfoCorePropertiesTypesCheckResult) {
            return false;
        }

        // Check whether the input argument is an object containing the properties whose values are valid (i.e., is (or is not) 
        // a specific value or is within a specified range) or not
        const dumbBinCreateInfoValuesCheckResult = 
            dumbBinCreateInfo.longitude >= -180 && dumbBinCreateInfo.longitude <= 180 && 
            dumbBinCreateInfo.latitude >= -90 && dumbBinCreateInfo.latitude <= 90 && 
            dumbBinCreateInfo.capacity >= 1 && dumbBinCreateInfo.capacity <= 1000 && 
            dumbBinCreateInfo.address !== "";

        return dumbBinCreateInfoValuesCheckResult;
    }

    /**
     * Verify whether the input dumb bin's update-related information is valid to be used in the database 
     * update operation or not
     * 
     * @param {any} dumbBinUpdateInfo any value
     * 
     * @returns {boolean} true if the input argument is valid, false otherwise
     */
    public static verifyDumbBinUpdateInfo(dumbBinUpdateInfo: any): boolean {
        return BinHelper.verifyDumbBinCreateInfo(dumbBinUpdateInfo) && mongoose.Types.ObjectId.isValid(dumbBinUpdateInfo?._id);
    }

    /**
     * Compute the nearest smart bin for each of the input dumb bins if there is any
     * 
     * @async
     * @param {LatLng[]} dumbBins an array of LatLng objects each containing both latitude and longitude properties of a dumb bin
     * 
     * @returns {(string | null)[]} an array of IDs of the smart bins or nulls where an ID string is present only if that input 
     *                              dumb bin has at least one smart bin around it within the predefined range, and a null otherwise
     */
    public static async computeNearestSmartBins(dumbBins: LatLng[]): Promise<(string | null)[]> {
        const nearestSmartBins: (string | null)[] = await Promise.all(
            // Find the nearest smart bin that is within the range of BIN_SEARCH_DISTANCE and return its ID if there exists one, 
            // otherwise a null is returned
            dumbBins.map(async (dumbBin) => 
                (await SmartBin.findOne(
                    {
                        location: {
                            $near: {
                                $geometry: {
                                    type: "Point",
                                    coordinates: [dumbBin.longitude, dumbBin.latitude]
                                },
                                $maxDistance: BIN_SEARCH_DISTANCE
                            }
                        }
                    },
                    "_id"
                ))?._id
            )
        );
        Logger.verboseLog(COMPUTE_NEAREST_SMART_BINS_LOG_TAG, "nearestSmartBins", nearestSmartBins, "\n");
        return nearestSmartBins;
    }

    /**
     * Update the nearestSmartBin field for each of the input dumb bins in the database 
     * 
     * @async
     * @param {LatLng[]} dumbBins an array of LatLng objects each containing both latitude and longitude properties of a dumb bin
     * 
     * @returns {boolean} true if the update succeeds without errors, false otherwise
     */
    public static async updateNearestSmartBins(dumbBins: IdLatLng[]): Promise<boolean> {
        try {
            // First compute the nearest smart bins
            const nearestSmartBins = await BinHelper.computeNearestSmartBins(dumbBins);
            Logger.verboseLog(UPDATE_NEAREST_SMART_BINS_LOG_TAG, "nearestSmartBins", nearestSmartBins, "\n");
            
            // Update the nearest smart bin field for each of the input dumb bins to its nearest smart bin's ID if 
            // there's any within the predefined search range, otherwise update it to undefined in a bulk write operation 
            const dumbBinsUpdateOnNearestSmartBinsBulkWriteResult = await DumbBin.bulkWrite(
                nearestSmartBins.map((nearestSmartBin, index) => ({
                    updateOne: {
                        filter: {
                            _id: new mongoose.Types.ObjectId(dumbBins[index]._id),
                        },
                        update: {
                            nearestSmartBin: nearestSmartBin ? nearestSmartBin : undefined
                        }
                    }
                }))
            );
            // Only continue if the bulk update of all input dumb bins succeeds above
            if (dumbBinsUpdateOnNearestSmartBinsBulkWriteResult.result?.ok !== 1 ||  
                dumbBinsUpdateOnNearestSmartBinsBulkWriteResult.result?.writeErrors.length !== 0) {
                Logger.verboseError(
                    UPDATE_NEAREST_SMART_BINS_LOG_TAG, 
                    "dumbBinsUpdateOnNearestSmartBinsBulkWriteResult", 
                    dumbBinsUpdateOnNearestSmartBinsBulkWriteResult, 
                    "\n"
                );
                throw new Error("Failed to update dumb bins' nearest smart bins");
            } 
            Logger.verboseLog(
                UPDATE_NEAREST_SMART_BINS_LOG_TAG, 
                "dumbBinsUpdateOnNearestSmartBinsBulkWriteResult", 
                dumbBinsUpdateOnNearestSmartBinsBulkWriteResult, 
                "\n"
            );

            return true;
        } catch (error) {
            Logger.error(UPDATE_NEAREST_SMART_BINS_LOG_TAG, error, "\n");
            return false;
        }
    }

    /**
     * Update the bins according to the input delete, create, and update-related information in the database
     * 
     * @async
     * @param {BinDeleteInfo[]} binsDeleteInfo an array of strings where each represents an ID of a bin to be deleted
     * @param {BinCreateInfo[]} binsCreateInfo an array of objects each containing the _id, longitude, latitude, address,
     *                                         capacity and if the bin is of type smart bin, then each object also contains 
     *                                         serialNumber, threshold, and lastUpdate properties of a bin to be created 
     * @param {BinUpdateInfo[]} binsUpdateInfo an array of objects each containing the _id, longitude, latitude, address,
     *                                         capacity and if the bin is of type smart bin, then each object also contains 
     *                                         threshold, and lastUpdate properties of a bin to be created 
     * @param {boolean} isSmart whether the input bin information is for a smart bin or not
     * 
     * @returns {boolean} true if the update succeeds without errors, false otherwise
     */
    public static async updateBins(
        binsDeleteInfo: BinDeleteInfo[],
        binsCreateInfo: BinCreateInfo[],
        binsUpdateInfo: BinUpdateInfo[],
        isSmart: boolean
    ): Promise<boolean> {
        try {
            // Construct the documents for delete-related operations to be used in a bulk write operation
            const binsDeleteBulkOperations = binsDeleteInfo.map((_id) => ({
                deleteOne: {
                    filter: { 
                        _id: new mongoose.Types.ObjectId(_id)
                    }
                }
            }));
            // Construct the documents for create-related operations to be used in a bulk write operation
            const binsCreateBulkOperations = binsCreateInfo.map((bin) => ({
                insertOne: {
                    document: Object.assign({
                        _id: new mongoose.Types.ObjectId(bin._id),
                        location: {
                            type: "Point",
                            coordinates: [bin.longitude, bin.latitude]
                        },
                        address: bin.address,
                        capacity: bin.capacity,
                    }, isSmart ? {
                        serialNumber: bin.serialNumber!,
                        threshold: bin.threshold!,
                        lastUpdated: bin.lastUpdated!
                    } : {})
                }
            }));
            // Construct the documents for update-related operations to be used in a bulk write operation
            // NOTE: For update of any existing dumb bin, its nearestSmartBin field is also updated to undefined 
            // as its location might have changed
            const binsUpdateBulkOperations = binsUpdateInfo.map((bin) => ({
                updateOne: {
                    filter: {
                        _id: new mongoose.Types.ObjectId(bin._id)
                    },
                    update: Object.assign({
                        location: {
                            type: "Point",
                            coordinates: [bin.longitude, bin.latitude]
                        },
                        address: bin.address,
                        capacity: bin.capacity
                    }, isSmart ? {
                        threshold: bin.threshold!,
                        lastUpdated: bin.lastUpdated!
                    } : {
                        nearestSmartBin: undefined
                    })
                }
            }));

            // Perform the bulk write operation on the correct database collection based on the input argument, isSmart 
            // to tell whether this operation is targeted at SmartBins collection or DumbBins collection
            const binsUpdateBulkWriteResult = await (isSmart ? SmartBin : DumbBin).bulkWrite(
                (binsDeleteBulkOperations as any[]).concat(binsCreateBulkOperations).concat(binsUpdateBulkOperations)
            );
            // Only continue if the bulk update of all input bins succeeds above
            if (binsUpdateBulkWriteResult.result?.ok !== 1 || 
                binsUpdateBulkWriteResult.result?.writeErrors.length !== 0) {
                Logger.verboseError(UPDATE_BINS_LOG_TAG, "binsUpdateBulkWriteResult", binsUpdateBulkWriteResult, "\n");
                throw new Error(`Failed to update ${isSmart ? "smart" : "dumb"} bins`);
            } 
            Logger.verboseLog(UPDATE_BINS_LOG_TAG, "binsUpdateBulkWriteResult", binsUpdateBulkWriteResult, "\n");
            
            return true;
        } catch (error) {
            Logger.error(UPDATE_BINS_LOG_TAG, error, "\n");
            return false;
        }
    }
}
