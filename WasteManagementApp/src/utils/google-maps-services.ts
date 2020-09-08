import { Client, TravelMode, UnitSystem, Status } from "@googlemaps/google-maps-services-js";

interface LatLng {
    latitude: number,
    longitude: number
}

interface DistanceMatrixElement {
    distance: number,
    duration: number
}

export class GoogleMapsServices {
    private client: Client;
    private maxOriginsPerRequest: number;
    private maxDestinationsPerRequest: number;
    private maxPairsPerRequest: number;

    constructor() {
        this.client = new Client({});
        this.maxOriginsPerRequest = 25;
        this.maxDestinationsPerRequest = 25;
        this.maxPairsPerRequest = 100;
    }
    
    public async computeDistanceMatrix(
        origins: LatLng[],
        destinations: LatLng[]
    ): Promise<DistanceMatrixElement[][]> {
        const distanceMatrix: DistanceMatrixElement[][] = Array.from(new Array(origins.length), () => []);
        let numOfOriginsPerRequest; 
        let numOfDestinationsPerRequest; 
        for (let i = 0; i < origins.length; i += numOfOriginsPerRequest) {
            numOfOriginsPerRequest = Math.min(origins.length - i, this.maxOriginsPerRequest);
            for (let j = 0; j < destinations.length; j += numOfDestinationsPerRequest) {
                numOfDestinationsPerRequest = Math.min(
                    destinations.length - j,
                    this.maxDestinationsPerRequest,
                    Math.floor(this.maxPairsPerRequest / numOfOriginsPerRequest)
                );
                const response = await this.client.distancematrix({
                    params: {
                        origins: origins.slice(i, i + numOfOriginsPerRequest),
                        destinations: destinations.slice(j, j + numOfDestinationsPerRequest),
                        mode: TravelMode.driving,
                        units: UnitSystem.metric,
                        language: "en-AU",
                        key: process.env.GOOGLE_MAPS_API_KEY as string
                    }
                });
                if (response.status === 200 && response.data.status === Status.OK) {
                    response.data.rows.forEach((row, offset) => 
                        row.elements.forEach(col => 
                            distanceMatrix[i + offset].push({
                                distance: col.status === "OK" ? col.distance.value : -1,
                                duration: col.status === "OK" ? col.duration.value : -1
                            })
                        )
                    );
                }
            }
        }
        return distanceMatrix;
    }
}
