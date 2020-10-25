import fse from "fs-extra";
import path from "path";
import { expect } from "chai";
import { RoutingSolverAdapter, RoutingStrategy } from "../routing-solver-adapter";

describe("RoutingSolverAdapter", function() {
    before("copy the routing solver to the test folder", function() {
        this.timeout(10000);
        if (!fse.existsSync("./routing_solver")) {
            const routing_solver_folder_absolute_path = path.resolve(__dirname, "../../../routing_solver");
            fse.mkdirSync("./routing_solver");
            fse.copySync(routing_solver_folder_absolute_path, "./routing_solver");
        }
    });

    after("delete the routing solver from the test folder", function() {
        this.timeout(10000);
        if (fse.existsSync("./routing_solver")) {
            fse.removeSync("./routing_solver");
        }
    });

    const distanceMatrix = [
        [0, 548, 776, 696, 582, 274, 502, 194, 308, 194, 536, 502, 388, 354, 468, 776, 662],
        [548, 0, 684, 308, 194, 502, 730, 354, 696, 742, 1084, 594, 480, 674, 1016, 868, 1210],
        [776, 684, 0, 992, 878, 502, 274, 810, 468, 742, 400, 1278, 1164, 1130, 788, 1552, 754],
        [696, 308, 992, 0, 114, 650, 878, 502, 844, 890, 1232, 514, 628, 822, 1164, 560, 1358],
        [582, 194, 878, 114, 0, 536, 764, 388, 730, 776, 1118, 400, 514, 708, 1050, 674, 1244],
        [274, 502, 502, 650, 536, 0, 228, 308, 194, 240, 582, 776, 662, 628, 514, 1050, 708],
        [502, 730, 274, 878, 764, 228, 0, 536, 194, 468, 354, 1004, 890, 856, 514, 1278, 480],
        [194, 354, 810, 502, 388, 308, 536, 0, 342, 388, 730, 468, 354, 320, 662, 742, 856],
        [308, 696, 468, 844, 730, 194, 194, 342, 0, 274, 388, 810, 696, 662, 320, 1084, 514],
        [194, 742, 742, 890, 776, 240, 468, 388, 274, 0, 342, 536, 422, 388, 274, 810, 468],
        [536, 1084, 400, 1232, 1118, 582, 354, 730, 388, 342, 0, 878, 764, 730, 388, 1152, 354],
        [502, 594, 1278, 514, 400, 776, 1004, 468, 810, 536, 878, 0, 114, 308, 650, 274, 844],
        [388, 480, 1164, 628, 514, 662, 890, 354, 696, 422, 764, 114, 0, 194, 536, 388, 730],
        [354, 674, 1130, 822, 708, 628, 856, 320, 662, 388, 730, 308, 194, 0, 342, 422, 536],
        [468, 1016, 788, 1164, 1050, 514, 514, 662, 320, 274, 388, 650, 536, 342, 0, 764, 194],
        [776, 868, 1552, 560, 674, 1050, 1278, 742, 1084, 810, 1152, 274, 388, 422, 764, 0, 798],
        [662, 1210, 754, 1358, 1244, 708, 480, 856, 514, 468, 354, 844, 730, 536, 194, 798, 0]
    ]
    const nodeWeights = [0, 1, 1, 2, 4, 2, 4, 8, 8, 1, 2, 1, 2, 4, 4, 8, 8];

    describe("#execute", function() {
        it("should produce 4 routes for 4 vehicles where each route should contain a sequence of nodes in the specified order", async function() {

            const vehicleCapacities = [15, 15, 15, 15];
            const expectedResult = [
                [0, 1, 4, 3, 15, 0],
                [0, 14, 16, 10, 2, 0],
                [0, 7, 13, 12, 11, 0],
                [0, 9, 8, 6, 5, 0]
            ];
            const actualResult = await RoutingSolverAdapter.execute(
                distanceMatrix, 
                nodeWeights, 
                vehicleCapacities, 
                RoutingStrategy.AUTOMATIC
            );
            expect(actualResult).to.deep.equal(expectedResult);
        }).timeout(5000);

        it("should produce no routes for all 4 vehicles where each row should only contain -1", async function() {
            const vehicleCapacities = [15, 15, 15, 1];
            const expectedResult = [
                [-1],
                [-1],
                [-1],
                [-1]
            ];
            const actualResult = await RoutingSolverAdapter.execute(
                distanceMatrix, 
                nodeWeights, 
                vehicleCapacities, 
                RoutingStrategy.AUTOMATIC
            );
            expect(actualResult).to.deep.equal(expectedResult);
        }).timeout(50000);

        it("should produce 4 routes for 4 vehicles where the first vehicle should take care of all bins and the rest should stay at the depot", async function() {
            const vehicleCapacities = [1500, 15, 15, 15];
            const expectedResult = [
                [0, 7, 13, 12, 11, 15, 3, 4, 1, 5, 8, 6, 2, 10, 16, 14, 9, 0],
                [0, 0],
                [0, 0],
                [0, 0]
            ];
            const actualResult = await RoutingSolverAdapter.execute(
                distanceMatrix, 
                nodeWeights, 
                vehicleCapacities, 
                RoutingStrategy.AUTOMATIC
            );
            expect(actualResult).to.deep.equal(expectedResult);
        }).timeout(50000);
    });

    describe("#executeAllStrategies", async function() {
        it("should produce only a unique collection of 4 routes for 4 vehicles where each route should contain a sequence of nodes in the specified order", async function() {

            const vehicleCapacities = [15, 15, 15, 15];
            const expectedResult = [
                [0, 1, 4, 3, 15, 0],
                [0, 14, 16, 10, 2, 0],
                [0, 7, 13, 12, 11, 0],
                [0, 9, 8, 6, 5, 0]
            ];
            const actualResult = await RoutingSolverAdapter.executeAllStrategies(
                distanceMatrix, 
                nodeWeights, 
                vehicleCapacities
            );
            console.log(actualResult);
            expect(actualResult.length).to.equal(1);
            expect(actualResult[0]).to.deep.equal(expectedResult);
        }).timeout(50000);
    });
});