/**
 * Author name:
 * Last modified date: 
 * Description: 
 */
import { FULLNESS_THRESHOLD_RATIO_SELECTION_CRITERION } from "../constants/misc";
import BinDistance from "../models/bin-distance";
import Depot from "../models/depot";
import DumbBin from "../models/dumb-bin";
import FleetVehicle from "../models/fleet-vehicle";
import SmartBin from "../models/smart-bin";
import { GoogleMapsServicesAdapter } from "./google-maps-services-adapter";
import { RoutingSolverAdapter } from "./routing-solver-adapter";
import { BinDistanceInfo, DepotCollectInfo, DumbBinCollectInfo, FleetVehicleCollectInfo, SmartBinCollectInfo } from "./type-information";

export class BinCollectionScheduleHelper {
    public static async createAllPossibleBinCollectionSchedules(googleMapsServicesAdapter: GoogleMapsServicesAdapter) {
        try {
            const [depot]: DepotCollectInfo[] = await Depot.aggregate([
                // Limited to only one depot in this project as the routing solver is unable to support multiple depots
                {
                    $limit: 1
                },
                {
                    $project: {
                        longitude: {
                            $arrayElemAt: ["$location.coordinates", 0]
                        },
                        latitude: {
                            $arrayElemAt: ["$location.coordinates", 1]
                        },
                        volume: {
                            $literal: 0
                        }
                    }
                }
            ]);
            const smartBins: SmartBinCollectInfo[] = await SmartBin.aggregate([
                {
                    $project: {
                        longitude: {
                            $arrayElemAt: ["$location.coordinates", 0]
                        },
                        latitude: {
                            $arrayElemAt: ["$location.coordinates", 1]
                        },
                        capacity: true,
                        fullnessPercentage: {
                            $divide: ["$currentFullness", "$threshold"]
                        }
                    }
                },
                { 
                    $match: {
                        fullnessPercentage: {
                            $gte: FULLNESS_THRESHOLD_RATIO_SELECTION_CRITERION
                        }
                    }
                },
                {
                    $project: {
                        longitude: true,
                        latitude: true,
                        volume: {
                            $multiply: ["$capacity", "$fullnessPercentage"]
                        }
                    }
                }
            ]);
            const dumbBins: DumbBinCollectInfo[] = await DumbBin.aggregate([
                {
                    $match: {
                        $or: [
                            {
                                nearestSmartBin: {
                                    $in: smartBins.map(smartBin => smartBin._id)
                                }
                            },
                            {
                                nearestSmartBin: null
                            }
                        ]
                    }
                },
                {
                    $lookup: {
                        from: "SmartBins",
                        localField: "nearestSmartBin",
                        foreignField: "_id",
                        as: "nearestSmartBin"
                    }
                },
                {
                    $unwind: {
                        path: "$nearestSmartBin",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $project: {
                        longitude: {
                            $arrayElemAt: ["$location.coordinates", 0]
                        },
                        latitude: {
                            $arrayElemAt: ["$location.coordinates", 1]
                        },
                        volume: {
                            $ifNull: [
                                {
                                    $multiply: [
                                        {
                                            $divide: ["$nearestSmartBin.currentFullness", "$nearestSmartBin.threshold"]
                                        },
                                        "$capacity"
                                    ]
                                },
                                "$capacity"
                            ]
                        }
                    }
                }
            ]);
            const fleetVehicles: FleetVehicleCollectInfo[] = await FleetVehicle.aggregate([
                {
                    $match: {
                        available: true,
                        belongTo: depot._id
                    }
                },
                {
                    $project: {
                        capacity: true,
                    }
                }
            ]);
            console.log(fleetVehicles);
            const binDistances: BinDistanceInfo[] = await BinDistance.aggregate([
                {
                    $match : {
                        $and: [
                            {
                                $or: [
                                    {
                                        $and: [
                                            {
                                                origin: {
                                                    $in: smartBins.map(smartBin => smartBin._id)
                                                }
                                            },
                                            {
                                                originType: "SmartBin"
                                            }
                                        ]
                                    },
                                    {
                                        $and: [
                                            {
                                                origin: {
                                                    $in: dumbBins.map(dumbBin => dumbBin._id)
                                                }
                                            },
                                            {
                                                originType: "DumbBin"
                                            }
                                        ]
                                    },
                                    {
                                        origin: depot._id,
                                        originType: "Depot"
                                    }
                                ]
                            },
                            {
                                $or: [
                                    {
                                        $and: [
                                            {
                                                destination: {
                                                    $in: smartBins.map(smartBin => smartBin._id)
                                                }
                                            },
                                            {
                                                destinationType: "SmartBin"
                                            }
                                        ]
                                    },
                                    {
                                        $and: [
                                            {
                                                destination: {
                                                    $in: dumbBins.map(dumbBin => dumbBin._id)
                                                }
                                            },
                                            {
                                                destinationType: "DumbBin"
                                            }
                                        ]
                                    },
                                    {
                                        destination: depot._id,
                                        destinationType: "Depot"
                                    }
                                ]
                            }
                        ]
                    }
                },
                {
                    $project: {
                        _id: false,
                        __v: false
                    }
                }
            ]);

            const binDistanceMatrix: number[][] = Array.from(new Array(1 + smartBins.length + dumbBins.length), () => new Array(1 + smartBins.length + dumbBins.length).fill(-1));
            // Simulation of a bidirectional map
            const dictFromMatrixIndexToDocument: {
                [index: number]: any
            } = {
                0: Object.assign(depot, {
                    type: "Depot"
                })
            };
            const dictFromDocumentTypeAndIdToMatrixIndex: {
                [type: string]: {
                    [_id: string]: number
                }
            } = {
                Depot: {
                    [depot._id]: 0
                },
                SmartBin: {},
                DumbBin: {}
            };
            smartBins.forEach((smartBin, index) => {
                const mappedIndex = 1 + index;
                dictFromMatrixIndexToDocument[mappedIndex] = Object.assign(smartBin, {
                    type: "SmartBin"
                });
                dictFromDocumentTypeAndIdToMatrixIndex.SmartBin[smartBin._id] = mappedIndex;
            });
            dumbBins.forEach((dumbBin, index) => {
                const mappedIndex = 1 + smartBins.length + index;
                dictFromMatrixIndexToDocument[mappedIndex] = Object.assign(dumbBin, {
                    type: "DumbBin"
                });
                dictFromDocumentTypeAndIdToMatrixIndex.DumbBin[dumbBin._id] = mappedIndex;
            });

            binDistances.forEach((binDistance) => {
                const row = dictFromDocumentTypeAndIdToMatrixIndex[binDistance.originType][binDistance.origin];
                const col = dictFromDocumentTypeAndIdToMatrixIndex[binDistance.destinationType][binDistance.destination];
                binDistanceMatrix[row][col] = binDistance.distance;
            });

            const binWeights = [depot.volume].concat(smartBins.map(smartBin => smartBin.volume)).concat(dumbBins.map(dumbBin => dumbBin.volume)).map(Math.round);
            const vehicleCapacities = fleetVehicles.map(fleetVehicle => Math.round(fleetVehicle.capacity));

            const uniqueSetOfRoutesUsingIndex = await RoutingSolverAdapter.executeAllStrategies(binDistanceMatrix, binWeights, vehicleCapacities);
            const uniqueSetOfRoutesUsingCoordinates = uniqueSetOfRoutesUsingIndex.map((routesUsingIndex) => 
                routesUsingIndex.map((routeUsingIndex) => 
                    routeUsingIndex.length < 2 ? [] : routeUsingIndex.map((nodeInIndex) => ({
                        longitude: dictFromMatrixIndexToDocument[nodeInIndex].longitude as number,
                        latitude: dictFromMatrixIndexToDocument[nodeInIndex].latitude as number
                    }))
                )
            );

            const setOfBinCollectionSchedules = 
                await Promise.all(uniqueSetOfRoutesUsingCoordinates.map(async (routesUsingCoordinates) => ({
                    routes: await Promise.all(routesUsingCoordinates.map(async (routeUsingCoordinates, index) => ({
                        vehicle: fleetVehicles[index]._id,
                        directions: await googleMapsServicesAdapter.computeDirections(
                            routeUsingCoordinates[0],
                            routeUsingCoordinates[routeUsingCoordinates.length - 1],
                            routeUsingCoordinates.slice(1, routeUsingCoordinates.length - 1)
                        )
                    }))),
                    timestamp: new Date()
                })));

                return setOfBinCollectionSchedules;
        } catch(error) {
            console.error(error);
        }
    }
}
