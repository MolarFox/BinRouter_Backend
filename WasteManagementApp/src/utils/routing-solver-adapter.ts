import { $enum } from "ts-enum-util";
import { ROUTING_SOLVER_EXECUTABLE_RELATIVE_PATH } from "../constants/misc";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

export enum RoutingStrategy {
    AUTOMATIC = -1,
    GREEDY_DESCENT,
    GUIDED_LOCAL_SEARCH,
    SIMULATED_ANNEALING,
    TABU_SEARCH
}

export class RoutingSolverAdapter {
    private static readonly DISTANCE_MATRIX_COL_DELIMITER: string = ",";
    private static readonly DISTANCE_MATRIX_ROW_DELIMITER: string = "-";
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

            const routingSolver = spawn(
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
            
            routingSolver.stdout.on("data", (result: Buffer) => {
                result
                    .toString()
                    .split(RoutingSolverAdapter.ROUTE_DELIMITER)
                    .filter((route) => route)
                    .map((route) => route.split(RoutingSolverAdapter.ROUTE_NODE_DELIMITER).map((node) => parseInt(node, 10)))
                    .forEach((route) => routes.push(route));
            });

            routingSolver.on("exit", (code, signal) => {
                RoutingSolverAdapter.routingSolverProcess = null;
                if (code === 0 && signal === null) {
                    console.log(`Routing solver ${$enum.mapValue(routingStrategy).with({
                        [RoutingStrategy.AUTOMATIC]: "AUTOMATIC",
                        [RoutingStrategy.GREEDY_DESCENT]: "GREEDY_DESCENT",
                        [RoutingStrategy.GUIDED_LOCAL_SEARCH]: "GUIDED_LOCAL_SEARCH",
                        [RoutingStrategy.SIMULATED_ANNEALING]: "SIMULATED_ANNEALING",
                        [RoutingStrategy.TABU_SEARCH]: "TABU_SEARCH"
                    })} successfully generated the following routes: `, routes);
                    resolve(routes)
                } else {
                    console.log(`Routing solver did not terminate correctly with the exit code ${code} and ${signal} signal`);
                    resolve([]);
                }
            });

            routingSolver.on("error", (error) => {
                RoutingSolverAdapter.routingSolverProcess = null;
                console.error(error);
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
           routesByStrategy.push(await RoutingSolverAdapter.execute(distanceMatrix, nodeWeights, vehicleCapacities, routingStrategy));
        }
        return Array.from(
            new Set(
                routesByStrategy.map(routeByStrategy => JSON.stringify(routeByStrategy))
            )
        ).map(routeByStrategyString => JSON.parse(routeByStrategyString));
    }
}
