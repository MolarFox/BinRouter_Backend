/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definitions of all the logging-related constants.
 */

const TAG_DELIMITER = ".";

const APP = "bin_router";
const CONTROLLERS = "controllers";
const UTILS = "utils";
const CONTROLLERS_TAG = [APP, CONTROLLERS].join(TAG_DELIMITER);
const UTILS_TAG = [APP, UTILS].join(TAG_DELIMITER);

export const INDEX_LOG_TAG = [APP, "index"].join(TAG_DELIMITER);
export const DATABASE_LOG_TAG = [APP, "database"].join(TAG_DELIMITER);

const BIN_MODULE_TAG = [CONTROLLERS_TAG, "bin"].join(TAG_DELIMITER);
const SCHEDULE_MODULE_TAG = [CONTROLLERS_TAG, "schedule"].join(TAG_DELIMITER);
const VEHICLE_MODULE_TAG = [CONTROLLERS_TAG, "vehicle"].join(TAG_DELIMITER);

const BIN_COLLECTION_SCHEDULE_HELPER_MODULE_TAG = [UTILS_TAG, "bin_collection_schedule_helper"].join(TAG_DELIMITER);
const BIN_DISTANCE_HELPER_MODULE_TAG = [UTILS_TAG, "bin_distance_helper"].join(TAG_DELIMITER);
const BIN_HELPER_MODULE_TAG = [UTILS_TAG, "bin_helper"].join(TAG_DELIMITER);
const GOOGLE_MAPS_SERVICES_ADAPTER_MODULE_TAG = [UTILS_TAG, "google_maps_services_adapter"].join(TAG_DELIMITER);

export const GET_BINS_LOG_TAG = [BIN_MODULE_TAG, "getBins"].join(TAG_DELIMITER);
export const MODIFY_BINS_LOG_TAG = [BIN_MODULE_TAG, "modifyBins"].join(TAG_DELIMITER);
export const GET_BIN_COLLECTION_SCHEDULES_LOG_TAG = [SCHEDULE_MODULE_TAG, "getBinCollectionSchedules"].join(TAG_DELIMITER);
export const GET_BIN_COLLECTION_SCHEDULES_TIMESTAMP_LOG_TAG = [SCHEDULE_MODULE_TAG, "getBinCollectionSchedulesTimestamp"].join(TAG_DELIMITER);
export const GET_FLEET_VEHICLES = [VEHICLE_MODULE_TAG, "getFleetVehicles"].join(TAG_DELIMITER);
export const MODIFY_FLEET_VEHICLES = [VEHICLE_MODULE_TAG, "modifyFleetVehicles"].join(TAG_DELIMITER);

export const UPDATE_BIN_COLLECTION_SCHEDULES_LOG_TAG = [BIN_COLLECTION_SCHEDULE_HELPER_MODULE_TAG, "updateBinCollectionSchedules"].join(TAG_DELIMITER);
export const UPDATE_ALL_BIN_DISTANCES_LOG_TAG = [BIN_DISTANCE_HELPER_MODULE_TAG, "updateAllBinDistances"].join(TAG_DELIMITER);
export const UPDATE_BIN_DISTANCES_LOG_TAG = [BIN_DISTANCE_HELPER_MODULE_TAG, "updateBinDistances"].join(TAG_DELIMITER);
export const COMPUTE_NEAREST_SMART_BINS_LOG_TAG = [BIN_HELPER_MODULE_TAG, "computeNearestSmartBins"].join(TAG_DELIMITER);
export const UPDATE_NEAREST_SMART_BINS_LOG_TAG = [BIN_HELPER_MODULE_TAG, "updateNearestSmartBins"].join(TAG_DELIMITER);
export const UPDATE_BINS_LOG_TAG = [BIN_HELPER_MODULE_TAG, "updateBins"].join(TAG_DELIMITER);
export const COMPUTE_DISTANCE_MATRIX_LOG_TAG = [GOOGLE_MAPS_SERVICES_ADAPTER_MODULE_TAG, "computeDistanceMatrix"].join(TAG_DELIMITER);
export const COMPUTE_DIRECTIONS_LOG_TAG = [GOOGLE_MAPS_SERVICES_ADAPTER_MODULE_TAG, "computeDirections"].join(TAG_DELIMITER);
