import mongoose from "mongoose";

export class FleetVehicleHelper {
    public static verifyFleetVehicleDeleteInfo(fleetVehicleDeleteInfo: any): boolean {
        return typeof fleetVehicleDeleteInfo === "string" && mongoose.Types.ObjectId.isValid(fleetVehicleDeleteInfo);
    }

    public static verifyFleetVehicleCreateInfo(fleetVehicleCreateInfo: any): boolean {
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
        const fleetVehicleCreateInfoCorePropertiesTypesCheckResult =
            Object
                .keys(fleetVehicleCreateInfoCorePropertiesTypes)
                .map(property => typeof fleetVehicleCreateInfo[property] === fleetVehicleCreateInfoCorePropertiesTypes[property])
                .every(isMatched => isMatched)
        const fleetVehicleCreateInfoOptionalPropertiesTypesCheckResult = 
            (typeof fleetVehicleCreateInfo.homeDepot === "string" && 
            mongoose.Types.ObjectId.isValid(fleetVehicleCreateInfo.homeDepot)) || 
            typeof fleetVehicleCreateInfo.homeDepot === "undefined";
        if (!fleetVehicleCreateInfoCorePropertiesTypesCheckResult || 
            !fleetVehicleCreateInfoOptionalPropertiesTypesCheckResult) {
            return false;
        }

        const fleetVehicleCreateInfoValuesCheckResult = 
            fleetVehicleCreateInfo.rego !== "" && 
            fleetVehicleCreateInfo.capacity >= 1 && fleetVehicleCreateInfo.capacity <= 50000 && 
            fleetVehicleCreateInfo.icon >= 0 && fleetVehicleCreateInfo.icon <= 11;
        return fleetVehicleCreateInfoValuesCheckResult;
    }

    public static verifyFleetVehicleUpdateInfo(fleetVehicleUpdateInfo: any): boolean {
        return FleetVehicleHelper.verifyFleetVehicleCreateInfo(fleetVehicleUpdateInfo) && mongoose.Types.ObjectId.isValid(fleetVehicleUpdateInfo?._id);
    }
}
