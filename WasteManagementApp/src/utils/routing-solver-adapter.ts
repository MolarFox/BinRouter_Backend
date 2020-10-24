/**
 * Author name: Yisong Yu
 * Last modified date: October 24, 2020
 * Description: 
 * This source code file includes all the external (C++) Routing Solver-related calls wrapped in the function execute 
 * contained in the adapter class named RoutingSolverAdapter that is not intended to be instantiated, as any subsequent 
 * call will trigger the sending of a KILL signal to the process spawned by the previous call to forcefully terminate
 * it in order to prevent system resources from being eaten up quickly by those expired (i.e., past) processes, and at 
 * the same time, also avoid the newest results returned by the latest call from being overwritten by the expired results 
 * returned by the previous call to the caller, so that the data integrity of the computed routing schedules can be 
 * maintained. It provides the functionality of executing the external (C++) routing solver program with user-specified 
 * routing strategy, and executing the external (C++) routing solver program with all possible routing strategies available, 
 * and having only unique routing schedules returned as the result.
 */

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { $enum } from "ts-enum-util";
import { ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH } from "../constants/misc";
import { Logger } from "./logger";

export enum RoutingStrategy {
    AUTOMATIC = -1,
    GREEDY_DESCENT,
    GUIDED_LOCAL_SEARCH,
    SIMULATED_ANNEALING,
    TABU_SEARCH
}

export class RoutingSolverAdapter {
    // Since all the input arguments to the routing solver program are to be specified as the command line arguments, 
    // the following constants define the delimiter used to separate different parts of a command line argument string, 
    // so that it can be properly parsed by the routing solver program
    private static readonly DISTANCE_MATRIX_COL_DELIMITER: string = ",";
    private static readonly DISTANCE_MATRIX_ROW_DELIMITER: string = "#";
    private static readonly NODE_WEIGHT_DELIMITER: string = ",";
    private static readonly VEHICLE_CAPACITY_DELIMITER: string = ",";
    private static readonly ROUTE_DELIMITER: string = "\n";
    private static readonly ROUTE_NODE_DELIMITER: string = ",";

    // routingSolverProcess stores the handle to the routing solver process spawned by the latest call to it if there's any
    private static routingSolverProcess: ChildProcessWithoutNullStreams | null = null;

    /**
     * Execute the external (C++) routing solver program to compute an optimised routing schedule (i.e., in
     * terms of the total distances that need to be travelled) that allow all the nodes each with a fixed demand
     * (i.e., weight or volume) to be collected by only a limited number of vehicles each with a fixed capacity
     * 
     * @async
     * @param {number[][]} distanceMatrix a distance matrix containing the distance between each pair of nodes 
     *                                    (i.e., distanceMatrix[i][j] contains the distance between the node i 
     *                                    as origin, and the node j as destination), with a matched number of 
     *                                    rows and columns
     * @param {number[]} nodeWeights an array containing the weight (i.e., volume of item to be picked up) of each 
     *                               node, with a length equal to the number of rows and columns of distanceMatrix 
     *                               specified as the first argument
     * @param {number[]} vehicleCapacities an array containing the capacity (i.e., total volume of items that can 
     *                                     fit in) of each vehicle that will collect a subset of nodes    
     * @param {RoutingStrategy} routingStrategy the routing strategy used for finding the optimised routing schedule 
     *                                          of nodes given the constraints specified as arguments above
     * @returns {number[][]} an array of arrays where the inner array at index i specifies the optimised visiting 
     *                       (i.e, collection) order of nodes for the vehicle with the capacity specified at index i
     *                       in the third input argument, vehicleCapacities
     */
    public static execute(
        distanceMatrix: number[][], 
        nodeWeights: number[], 
        vehicleCapacities: number[], 
        routingStrategy: RoutingStrategy
    ): Promise<number[][]> {
        return new Promise((resolve, reject) => {
            // Initialise the routes to be returned at the end
            const routes: number[][] = [];

            // If the process spawned by a previous call to the routing solver program has not yet finished its task, 
            // send a KILL signal to forcefully terminate its execution, and the result of the previous call is expired 
            // given that a new invocation is about to be made on the latest input information
            if (RoutingSolverAdapter.routingSolverProcess) {
                RoutingSolverAdapter.routingSolverProcess.kill("SIGKILL");
                RoutingSolverAdapter.routingSolverProcess = null;
            }

            // Spawn a new routing solver process with each of the input arguments transformed to its appropriate string
            // format to be used as the command line arguments passed to the routing solver process
            RoutingSolverAdapter.routingSolverProcess = spawn(
                ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH, 
                [
                    distanceMatrix.map(
                        row => row.map(
                            col => col.toString()
                        ).join(RoutingSolverAdapter.DISTANCE_MATRIX_COL_DELIMITER)
                    ).join(RoutingSolverAdapter.DISTANCE_MATRIX_ROW_DELIMITER),
                    nodeWeights.join(RoutingSolverAdapter.NODE_WEIGHT_DELIMITER),
                    vehicleCapacities.join(RoutingSolverAdapter.VEHICLE_CAPACITY_DELIMITER),
                    routingStrategy.toString()
                ],
                {
                    // NOTE: this process must be spawned with a shell, otherwise it will not work properly
                    shell: true
                }
            );
            
            // Get the time when the spawned process starts its computation
            const startTime = Date.now();

            // This callback will be invoked when the output data is printed to the standard output
            RoutingSolverAdapter.routingSolverProcess.stdout.on("data", (result: Buffer) => {
                // Capture and parse the output and store the result into routes variable to be returned later
                result
                    .toString()
                    .split(RoutingSolverAdapter.ROUTE_DELIMITER)
                    .filter(route => route)
                    .map(route => route.split(RoutingSolverAdapter.ROUTE_NODE_DELIMITER).map(node => parseInt(node, 10)))
                    .forEach(route => routes.push(route));
            });

            // This callback will be invoked when the process completes
            RoutingSolverAdapter.routingSolverProcess.on("exit", (code, signal) => {
                // Record the time when the process ends its computation
                const endTime = Date.now();
                // Convert the enumerable to its corresponding string format
                const routingStrategyString = $enum.mapValue(routingStrategy).with({
                    [RoutingStrategy.AUTOMATIC]: "AUTOMATIC",
                    [RoutingStrategy.GREEDY_DESCENT]: "GREEDY_DESCENT",
                    [RoutingStrategy.GUIDED_LOCAL_SEARCH]: "GUIDED_LOCAL_SEARCH",
                    [RoutingStrategy.SIMULATED_ANNEALING]: "SIMULATED_ANNEALING",
                    [RoutingStrategy.TABU_SEARCH]: "TABU_SEARCH"
                })
                // Log this performance metrics
                Logger.logPerformance(
                    `Routing solver using ${routingStrategyString} took ${(endTime - startTime) / 1000} seconds ` + 
                    `to finish processing a distance matrix of size ${distanceMatrix.length}x${distanceMatrix[0].length}`,
                    "\n"
                );
                RoutingSolverAdapter.routingSolverProcess = null;
                // Only return (i.e., resolve in a promise) the routes if the termination code indicates a success and the 
                // process does not terminate due to a received signal, otherwise return an empty array indicating a failure 
                // of finding the routes
                if (code === 0 && signal === null) {
                    Logger.log(`Routing solver using ${routingStrategyString} successfully generated the following routes: `, routes, "\n");
                    resolve(routes)
                } else {
                    Logger.error(`Routing solver using ${routingStrategyString} did not terminate correctly with the exit code ${code} and ${signal} signal`, "\n");
                    resolve([]);
                }
            });

            // This callback will be invoked when there's an error occurred during the execution of the process
            RoutingSolverAdapter.routingSolverProcess.on("error", (error) => {
                RoutingSolverAdapter.routingSolverProcess = null;
                Logger.error(error, "\n");
                // Throw (i.e., reject in a promise) the error
                reject(error);
            });
        });
    }

    /**
     * A wrapper function of the execute function to execute the routing solver program with all available routing strategies
     * 
     * @async
     * @param {number[][]} distanceMatrix a distance matrix containing the distance between each pair of nodes 
     *                                    (i.e., distanceMatrix[i][j] contains the distance between the node i 
     *                                    as origin, and the node j as destination), with a matched number of 
     *                                    rows and columns
     * @param {number[]} nodeWeights an array containing the weight (i.e., volume of item to be picked up) of each 
     *                               node, with a length equal to the number of rows and columns of distanceMatrix 
     *                               specified as the first argument
     * @param {number[]} vehicleCapacities an array containing the capacity (i.e., total volume of items that can 
     *                                     fit in) of each vehicle that will collect a subset of nodes
     * 
     * @returns {number[][][]} an array of arrays of arrays where each array of arrays in the outmost array is simply a 
     *                         routing schedule result returnd from the execute function, and each of these routing 
     *                         schedule results is unique
     */
    public static async executeAllStrategies(
        distanceMatrix: number[][], 
        nodeWeights: number[], 
        vehicleCapacities: number[]
    ): Promise<number[][][]> {
        // Initialise the array of routes to be returned at the end
        const routesByStrategy: number[][][] = [];
        // Execute the routing solver program with all available strategies specified in the enumerable, RoutingStrategy
        for (const routingStrategy of $enum(RoutingStrategy).values()) {
            routesByStrategy.push(
               await RoutingSolverAdapter.execute(distanceMatrix, nodeWeights, vehicleCapacities, routingStrategy)
            );
        }

        // Eliminate the duplicates of the same routing schedule results before returning
        return Array.from(
            new Set(
                routesByStrategy.map(routeByStrategy => JSON.stringify(routeByStrategy))
            )
        ).map(routeByStrategyString => JSON.parse(routeByStrategyString));
    }
}
