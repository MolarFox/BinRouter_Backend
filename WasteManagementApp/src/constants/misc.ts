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

export const BIN_SEARCH_DISTANCE = 1000;

export const ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH = "./routing_solver/bin/routing";

export const FULLNESS_THRESHOLD_RATIO_SELECTION_CRITERION = 0.5;