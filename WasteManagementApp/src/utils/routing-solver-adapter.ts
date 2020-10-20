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
    private static readonly DISTANCE_MATRIX_COL_DELIMITER: string = ",";
    private static readonly DISTANCE_MATRIX_ROW_DELIMITER: string = "#";
    private static readonly NODE_WEIGHT_DELIMITER: string = ",";
    private static readonly VEHICLE_CAPACITY_DELIMITER: string = ",";
    private static readonly ROUTE_DELIMITER: string = "\n";
    private static readonly ROUTE_NODE_DELIMITER: string = ",";
    
    private static routingSolverProcess: ChildProcessWithoutNullStreams | null = null;

    public static execute(
        distanceMatrix: number[][], 
        nodeWeights: number[], 
        vehicleCapacities: number[], 
        routingStrategy: RoutingStrategy
    ): Promise<number[][]> {
        return new Promise((resolve, reject) => {
            const routes: number[][] = [];

            if (RoutingSolverAdapter.routingSolverProcess) {
                RoutingSolverAdapter.routingSolverProcess.kill("SIGKILL");
                RoutingSolverAdapter.routingSolverProcess = null;
            }

            RoutingSolverAdapter.routingSolverProcess = spawn(
                ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH, 
                [
                    distanceMatrix.map(
                        (row) => row.map(
                            (col) => col.toString()
                        ).join(RoutingSolverAdapter.DISTANCE_MATRIX_COL_DELIMITER)
                    ).join(RoutingSolverAdapter.DISTANCE_MATRIX_ROW_DELIMITER),
                    nodeWeights.join(RoutingSolverAdapter.NODE_WEIGHT_DELIMITER),
                    vehicleCapacities.join(RoutingSolverAdapter.VEHICLE_CAPACITY_DELIMITER),
                    routingStrategy.toString()
                ],
                {
                    shell: true
                }
            );
            
            const startTime = Date.now();

            RoutingSolverAdapter.routingSolverProcess.stdout.on("data", (result: Buffer) => {
                result
                    .toString()
                    .split(RoutingSolverAdapter.ROUTE_DELIMITER)
                    .filter((route) => route)
                    .map((route) => route.split(RoutingSolverAdapter.ROUTE_NODE_DELIMITER).map((node) => parseInt(node, 10)))
                    .forEach((route) => routes.push(route));
            });

            RoutingSolverAdapter.routingSolverProcess.on("exit", (code, signal) => {
                const endTime = Date.now();
                const routingStrategyString = $enum.mapValue(routingStrategy).with({
                    [RoutingStrategy.AUTOMATIC]: "AUTOMATIC",
                    [RoutingStrategy.GREEDY_DESCENT]: "GREEDY_DESCENT",
                    [RoutingStrategy.GUIDED_LOCAL_SEARCH]: "GUIDED_LOCAL_SEARCH",
                    [RoutingStrategy.SIMULATED_ANNEALING]: "SIMULATED_ANNEALING",
                    [RoutingStrategy.TABU_SEARCH]: "TABU_SEARCH"
                })
                Logger.logPerformance(
                    `Routing solver using ${routingStrategyString} took ${(endTime - startTime) / 1000} seconds ` + 
                    `to finish processing a distance matrix of size ${distanceMatrix.length}x${distanceMatrix[0].length}`,
                    "\n"
                );
                RoutingSolverAdapter.routingSolverProcess = null;
                if (code === 0 && signal === null) {
                    Logger.log(`Routing solver using ${routingStrategyString} successfully generated the following routes: `, routes, "\n");
                    resolve(routes)
                } else {
                    Logger.error(`Routing solver using ${routingStrategyString} did not terminate correctly with the exit code ${code} and ${signal} signal`, "\n");
                    resolve([]);
                }
            });

            RoutingSolverAdapter.routingSolverProcess.on("error", (error) => {
                RoutingSolverAdapter.routingSolverProcess = null;
                Logger.error(error, "\n");
                reject(error);
            });
        });
    }

    public static async executeAllStrategies(
        distanceMatrix: number[][], 
        nodeWeights: number[], 
        vehicleCapacities: number[]
    ): Promise<number[][][]> {
        const routesByStrategy: number[][][] = [];
        for (const routingStrategy of $enum(RoutingStrategy).values()) {
            routesByStrategy.push(
               await RoutingSolverAdapter.execute(distanceMatrix, nodeWeights, vehicleCapacities, routingStrategy)
            );
        }
        return Array.from(
            new Set(
                routesByStrategy.map(routeByStrategy => JSON.stringify(routeByStrategy))
            )
        ).map(routeByStrategyString => JSON.parse(routeByStrategyString));
    }
}
