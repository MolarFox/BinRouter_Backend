/**
 * Author name: Yisong Yu
 * Last modified date: October 25, 2020
 * Description: 
 * This source code file includes the definitions of all the miscellaneous constants.
 */

/*
    *    *    *    *    *    *
    ┬    ┬    ┬    ┬    ┬    ┬
    │    │    │    │    │    │
    │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
    │    │    │    │    └───── month (1 - 12)
    │    │    │    └────────── day of month (1 - 31)
    │    │    └─────────────── hour (0 - 23)
    │    └──────────────────── minute (0 - 59)
    └───────────────────────── second (0 - 59, OPTIONAL)
*/
export const DAILY_UPDATE_TIME = "0 0 11 * * *";

// BIN_SEARCH_DISTANCE defines the maximum search distance for a nearest smart bin of a dumb bin in metres
export const BIN_SEARCH_DISTANCE = 1000;

export const ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH = "./routing_solver/bin/routing";

// FULLNESS_THRESHOLD_RATIO_SELECTION_CRITERION defines the selection criterion for smart bins to be collected, where
// any smart bin whose fullness percentage (i.e., currentFullness / threshold) is over this ratio, it gets included 
export const FULLNESS_THRESHOLD_RATIO_SELECTION_CRITERION = 0.5;

export const LOG_DIRECTORY_RELATIVE_PATH = "./logs";
export const SYSTEM_LOG_FILENAME = "system_log.log";
export const SYSTEM_ERROR_FILENAME = "system_error.log";
export const SYSTEM_PERFORMANCE_LOG_FILENAME = "system_performance_log.log";
export const INCOMING_REQUEST_LOG_FILENAME = "incoming_request_log.log";
