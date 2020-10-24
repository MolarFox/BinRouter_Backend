/**
 * Author name: Yisong Yu
 * Last modified date: October 24, 2020
 * Description: 
 * This source code file includes all the fleet vehicle-related helper functions grouped in the class named 
 * FleetVehicleHelper that is not intended to be instantiated. It provides the functionality of verifying the 
 * fleet vehicles' delete, create, and update-related information retrieved from the incoming HTTP request
 * to improve the robustness of the system.
 */

import mongoose from "mongoose";

export class FleetVehicleHelper {
    /**
     * Prevent others from instantiating this class
     */
    private constructor() {}

    /**
     * Verify whether the input fleet vehicle's delete-related information is valid to be used in the database 
     * delete operation or not
     * 
     * @param {any} fleetVehicleDeleteInfo any value
     * 
     * @returns {boolean} true if the input argument is valid, false otherwise
     */
    public static verifyFleetVehicleDeleteInfo(fleetVehicleDeleteInfo: any): boolean {
        return typeof fleetVehicleDeleteInfo === "string" && mongoose.Types.ObjectId.isValid(fleetVehicleDeleteInfo);
    }

    /**
     * Verify whether the input fleet vehicle's create-related information is valid to be used in the database 
     * create operation or not
     * 
     * @param {any} fleetVehicleCreateInfo any value
     * 
     * @returns {boolean} true if the input argument is valid, false otherwise
     */
    public static verifyFleetVehicleCreateInfo(fleetVehicleCreateInfo: any): boolean {
        // The first condition (i.e., !fleetVehicleCreateInfo) is to check whether the input argument is null or 
        // not as typeof null will return "object" as well
        if (!fleetVehicleCreateInfo || typeof fleetVehicleCreateInfo !== "object") {
            return false;
        }

        const fleetVehicleCreateInfoCorePropertiesTypes: {
            [property: string]: string
        } = {
            rego: "string",
            capacity: "number",
            available: "boolean",
            icon: "number"
        }
        // Check whether the input argument is an object containing the core properties with corresponding value types
        // specified above in fleetVehicleCreateInfoCorePropertiesTypes
        const fleetVehicleCreateInfoCorePropertiesTypesCheckResult =
            Object
                .keys(fleetVehicleCreateInfoCorePropertiesTypes)
                .map(property => typeof fleetVehicleCreateInfo[property] === fleetVehicleCreateInfoCorePropertiesTypes[property])
                .every(isMatched => isMatched)
        // Check whether the input argument is an object containing any of the specified optional properties with 
        // corresponding value types or not
        const fleetVehicleCreateInfoOptionalPropertiesTypesCheckResult = 
            (typeof fleetVehicleCreateInfo.homeDepot === "string" && 
            mongoose.Types.ObjectId.isValid(fleetVehicleCreateInfo.homeDepot)) || 
            typeof fleetVehicleCreateInfo.homeDepot === "undefined";

        if (!fleetVehicleCreateInfoCorePropertiesTypesCheckResult || 
            !fleetVehicleCreateInfoOptionalPropertiesTypesCheckResult) {
            return false;
        }

        // Check whether the input argument is an object containing the properties whose values are valid (i.e., is (or is not) 
        // a specific value or is within a specified range) or not
        const fleetVehicleCreateInfoValuesCheckResult = 
            fleetVehicleCreateInfo.rego !== "" && 
            fleetVehicleCreateInfo.capacity >= 1 && fleetVehicleCreateInfo.capacity <= 50000 && 
            fleetVehicleCreateInfo.icon >= 0 && fleetVehicleCreateInfo.icon <= 11;

        return fleetVehicleCreateInfoValuesCheckResult;
    }

    /**
     * Verify whether the input fleet vehicle's update-related information is valid to be used in the database 
     * update operation or not
     * 
     * @param {any} fleetVehicleUpdateInfo any value
     * 
     * @returns {boolean} true if the input argument is valid, false otherwise
     */
    public static verifyFleetVehicleUpdateInfo(fleetVehicleUpdateInfo: any): boolean {
        return FleetVehicleHelper.verifyFleetVehicleCreateInfo(fleetVehicleUpdateInfo) && mongoose.Types.ObjectId.isValid(fleetVehicleUpdateInfo?._id);
    }
}
