import { Client, TravelMode, UnitSystem, Status, Language } from "@googlemaps/google-maps-services-js";
import { DirectionsResponseData } from "@googlemaps/google-maps-services-js/dist/directions";
import { COMPUTE_DIRECTIONS_LOG_TAG, COMPUTE_DISTANCE_MATRIX_LOG_TAG } from "../constants/log-tag";
import { Logger } from "./logger";
import { DistanceMatrixElement, LatLng } from "./type-information";

export class GoogleMapsServicesAdapter {
    private client: Client;
    private maxOriginsPerRequest: number;
    private maxDestinationsPerRequest: number;
    private maxPairsPerRequest: number;
    private maxWaypointsPerRequest: number;
    private maxRetryLimit: number;

    constructor() {
        this.client = new Client({});
        this.maxOriginsPerRequest = 25;
        this.maxDestinationsPerRequest = 25;
        this.maxPairsPerRequest = 100;
        this.maxWaypointsPerRequest = 25;
        this.maxRetryLimit = 2;
    }
    
    public async computeDistanceMatrix(
        origins: LatLng[],
        destinations: LatLng[]
    ): Promise<DistanceMatrixElement[][]> {
        const distanceMatrix: DistanceMatrixElement[][] = Array.from(new Array(origins.length), () => []);
        let numOfOriginsPerRequest: number; 
        let numOfDestinationsPerRequest: number; 
        for (let i = 0; i < origins.length; i += numOfOriginsPerRequest) {
            numOfOriginsPerRequest = Math.min(origins.length - i, this.maxOriginsPerRequest);
            for (let j = 0; j < destinations.length; j += numOfDestinationsPerRequest) {
                numOfDestinationsPerRequest = Math.min(
                    destinations.length - j,
                    this.maxDestinationsPerRequest,
                    Math.floor(this.maxPairsPerRequest / numOfOriginsPerRequest)
                );
                const getDistanceMatrix = () => this.client.distancematrix({
                    params: {
                        origins: origins.slice(i, i + numOfOriginsPerRequest),
                        destinations: destinations.slice(j, j + numOfDestinationsPerRequest),
                        mode: TravelMode.driving,
                        units: UnitSystem.metric,
                        language: Language.en_Au,
                        key: process.env.GOOGLE_MAPS_API_KEY as string
                    }
                });
                let retryCount = 0;
                let retryTimeInterval = 1000;
                let response = await getDistanceMatrix();
                while (retryCount < this.maxRetryLimit && response.data.status === Status.OVER_QUERY_LIMIT) {
                    await new Promise(resolve => setTimeout(resolve, retryTimeInterval));
                    response = await getDistanceMatrix();
                    retryCount++;
                    retryTimeInterval += 1000;
                }
                if (response.status === 200 && response.data.status === Status.OK) {
                    Logger.verboseLog(COMPUTE_DISTANCE_MATRIX_LOG_TAG, "response", response, "\n");
                    response.data.rows.forEach((row, offset) => 
                        row.elements.forEach(col => 
                            distanceMatrix[i + offset].push({
                                distance: col.status === "OK" ? col.distance.value : -1,
                                duration: col.status === "OK" ? col.duration.value : -1
                            })
                        )
                    );
                } else {
                    Logger.verboseError(COMPUTE_DISTANCE_MATRIX_LOG_TAG, "response", response, "\n");
                }
            }
        }
        return distanceMatrix;
    }

    public async computeDirections(
        origin: LatLng,
        destination: LatLng,
        waypoints?: LatLng[],
    ): Promise<DirectionsResponseData[]> {
        const directions: DirectionsResponseData[] = [];
        const allWaypoints = [origin].concat(waypoints ? waypoints : []).concat([destination]);
        for (let i = 0; i < allWaypoints.length - 1; i += (this.maxWaypointsPerRequest - 1)) {
            const destinationIndex = Math.min(i + this.maxWaypointsPerRequest - 1, allWaypoints.length - 1);
            const getDirections = () => this.client.directions({
                params: {
                    origin: allWaypoints[i],
                    destination: allWaypoints[destinationIndex],
                    waypoints: allWaypoints.slice(i + 1, destinationIndex),
                    alternatives: false,
                    optimize: false,
                    mode: TravelMode.driving,
                    units: UnitSystem.metric,
                    language: Language.en_Au,
                    key: process.env.GOOGLE_MAPS_API_KEY as string
                }
            });
            let retryCount = 0;
            let retryTimeInterval = 1000;
            let response = await getDirections();
            while (retryCount < this.maxRetryLimit && response.data.status === Status.OVER_QUERY_LIMIT) {
                await new Promise(resolve => setTimeout(resolve, retryTimeInterval));
                response = await getDirections();
                retryCount++;
                retryTimeInterval += 1000;
            }
            if (response.status === 200 && response.data.status === Status.OK) {
                Logger.verboseLog(COMPUTE_DIRECTIONS_LOG_TAG, "response", response, "\n");
                directions.push(response.data);
            } else {
                Logger.verboseError(COMPUTE_DIRECTIONS_LOG_TAG, "response", response, "\n");
            }
        }
        return directions;
    }
}
