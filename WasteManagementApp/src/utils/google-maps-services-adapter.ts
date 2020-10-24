/**
 * Author name: Yisong Yu
 * Last modified date: October 24, 2020
 * Description: 
 * This source code file includes all the Google Maps-related API calls wrapped in their respective function 
 * contained in the adapter class named GoogleMapsServicesAdapter that is to be instantiated and used as a 
 * utility, with all details of processing and sanitization hidden. It provides the functionality of computing 
 * distance matrices and directions in real time.
 */

import { Client, TravelMode, UnitSystem, Status, Language } from "@googlemaps/google-maps-services-js";
import { DirectionsResponseData } from "@googlemaps/google-maps-services-js/dist/directions";
import { COMPUTE_DIRECTIONS_LOG_TAG, COMPUTE_DISTANCE_MATRIX_LOG_TAG } from "../constants/log-tag";
import { Logger } from "./logger";
import { DistanceMatrixElement, LatLng } from "./type-information";

export class GoogleMapsServicesAdapter {
    // client is a google maps services client as a light wrapper around API methods providing shared configuration
    private client: Client;
    // maxOriginsPerRequest specifies the maximum number of origins allowed to be specified in each request imposed by the Google API
    private maxOriginsPerRequest: number;
    // maxDestinationsPerRequest specifies the maximum number of destinations allowed to be specified in each request imposed by the Google API
    private maxDestinationsPerRequest: number;
    // maxPairsPerRequest specifies the maximum number of pairs of origins and destinations allowed to be specified in each request imposed by the Google API
    private maxPairsPerRequest: number;
    // maxWaypointsPerRequest specifies the maximum number of waypoints allowed to be specified in each request imposed by the Google API
    private maxWaypointsPerRequest: number;
    // maxRetryLimit specifies the maximum number of retries allowed to be performed if the API request fails before an error is thrown
    private maxRetryLimit: number;

    /**
     * Construct a GoogleMapsServicesAdapter instance
     */
    constructor() {
        this.client = new Client({});
        this.maxOriginsPerRequest = 25;
        this.maxDestinationsPerRequest = 25;
        this.maxPairsPerRequest = 100;
        this.maxWaypointsPerRequest = 25;
        this.maxRetryLimit = 2;
    }
    
    /**
     * Compute the distance matrix containing the estimated distance (in metres) and duration (in seconds) between 
     * each pair of origin (specified as part of the input argument, origins) and destination (specified as part of 
     * the input argument, destinations), and this distance matrix is to be returned as the output value
     * 
     * @async
     * @param {LatLng[]} origins an array of LatLng objects containing both latitude and longitude properties to be used as the origins
     * @param {LatLng[]} destinations an array of LatLng objects containing both latitude and longitude properties to be used as the destinations
     * 
     * @returns {DistanceMatrixElement[][]} a matrix (i.e., array of arrays), where each cell at row i and column
     *          j has an object containing both distance and duration properties, which corresponds to distance and
     *          duration to travel from the place specified in origin[i] to the place specified in destinations[j]
     */
    public async computeDistanceMatrix(
        origins: LatLng[],
        destinations: LatLng[]
    ): Promise<DistanceMatrixElement[][]> {
        // Initialise the distance matrix to be returned at the end
        const distanceMatrix: DistanceMatrixElement[][] = Array.from(new Array(origins.length), () => []);

        let numOfOriginsPerRequest: number; 
        let numOfDestinationsPerRequest: number; 
        for (let i = 0; i < origins.length; i += numOfOriginsPerRequest) {
            // Make sure that the number of origins specified in each request does not go over the maximum number of origins allowed, 
            // while still being able to handle the case where the number of remaining origins is smaller than this maximum boundary, 
            // in which case it will essentially take all the remaining origins to be included in the last API request sent later
            numOfOriginsPerRequest = Math.min(origins.length - i, this.maxOriginsPerRequest);

            for (let j = 0; j < destinations.length; j += numOfDestinationsPerRequest) {
                // Make sure that the number of destinations specified in each request does not go over the maximum number of destinations 
                // allowed, and also the total number of pairs of origin and destination does not go over the maximum number of pairs 
                // allowed (e.g., if the number of origins to be specified in the API request is 25, then even though the maximum number 
                // of destinations allowed is 25, we can only specify 4 destinations here to avoid the total number of pairs which is 
                // 25 * 4 = 100 to go over the maximum number of pairs allowed which is exactly 100), while still being able to handle 
                // the case where the number of remaining destinations is smaller than both of the above boundaries, in which case it will 
                // essentially take all the remaining destinations to be included in the last API request sent later
                numOfDestinationsPerRequest = Math.min(
                    destinations.length - j,
                    this.maxDestinationsPerRequest,
                    Math.floor(this.maxPairsPerRequest / numOfOriginsPerRequest)
                );
                
                // Function wrapper for making an actual request to Google Distance Matrix API
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

                // retryCount stores the number of retries that have been performed so far
                let retryCount = 0;
                // retryTimeInterval stores the time to wait in milliseconds between each retry of the API request
                let retryTimeInterval = 1000;
                let response = await getDistanceMatrix();
                // Only retry when the response status indicates that the service has received too many requests 
                // from our application within the allowed time period
                while (retryCount < this.maxRetryLimit && response.data.status === Status.OVER_QUERY_LIMIT) {
                    // Equivalent of calling sleep() function in C language
                    await new Promise(resolve => setTimeout(resolve, retryTimeInterval));
                    response = await getDistanceMatrix();
                    retryCount++;
                    // Increment the retry time interval in case if it is still too short
                    retryTimeInterval += 1000;
                }
                
                // Only populate the distance matrix if the API request succeed
                if (response.status === 200 && response.data.status === Status.OK) {
                    Logger.verboseLog(COMPUTE_DISTANCE_MATRIX_LOG_TAG, "response", response, "\n");
                    response.data.rows.forEach((row, offset) => 
                        row.elements.forEach((col) => 
                            // In case if we cannot travel from a particular origin to a particular destination, 
                            // its corresponding cell in the resulting distance matrix will contain -1 for both 
                            // distance and duration properties
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

    /**
     * NOTE: This function is not used in this application anymore as the task of computing the directions is delegated 
     * to the frontend client, but this may be used as a utility if needed in the future
     * 
     * Compute the actual directions (i.e., routes) that can be rendered (as polylines) in the Google Map for each 
     * journey starting at the origin (specified as the first input argument) and ending at the destination (specified 
     * as the second input argument), passing through all the waypoints (specified as the third input argument) as the 
     * stopover points, and the directions are to be returned as the output value
     * 
     * @async
     * @param {LatLng} origin a LatLng object containing both latitude and longitude properties to be used as the origin
     * @param {LatLng} destination a LatLng object containing both latitude and longitude properties to be used as the destination
     * @param {LatLng[]} [waypoints] an array of LatLng objects containing both latitude and longitude properties to be used as the waypoints
     * 
     * @returns {DirectionsResponseData[]} the directions response data received as part of the response of the API request (subject to changes)
     */
    public async computeDirections(
        origin: LatLng,
        destination: LatLng,
        waypoints?: LatLng[],
    ): Promise<DirectionsResponseData[]> {
        // Initialise the directions to be returned at the end
        const directions: DirectionsResponseData[] = [];

        // Concatenate the origin with all the waypoints followed by the destination into one array
        const allWaypoints = [origin].concat(waypoints ? waypoints : []).concat([destination]);
        // If the whole journey is partitioned into multiple parts to be sent by multiple requests due to the constraint 
        // imposed by the Google API, then the destination of the previous request becomes the origin of the next request, 
        // and therefore the step size of the following for loop is (maxWaypointsPerRequest - 1) instead of maxWaypointsPerRequest
        for (let i = 0; i < allWaypoints.length - 1; i += (this.maxWaypointsPerRequest - 1)) {
            // Make sure that the total number of waypoints including origin and destination specified in each request does not go over 
            // the maximum number of waypoints allowed, while still being able to handle the case where the number of remaining waypoints 
            // is smaller than this maximum boundary
            const destinationIndex = Math.min(i + this.maxWaypointsPerRequest - 1, allWaypoints.length - 1);
            // Function wrapper for making an actual request to Google Directions API
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

            // retryCount stores the number of retries that have been performed so far
            let retryCount = 0;
            // retryTimeInterval stores the time to wait in milliseconds between each retry of the API request
            let retryTimeInterval = 1000;
            let response = await getDirections();
            // Only retry when the response status indicates that the service has received too many requests 
            // from our application within the allowed time period
            while (retryCount < this.maxRetryLimit && response.data.status === Status.OVER_QUERY_LIMIT) {
                // Equivalent of calling sleep() function in C language
                await new Promise(resolve => setTimeout(resolve, retryTimeInterval));
                response = await getDirections();
                retryCount++;
                // Increment the retry time interval in case if it is still too short
                retryTimeInterval += 1000;
            }

            // Only populate the directions array if the API request succeed
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
