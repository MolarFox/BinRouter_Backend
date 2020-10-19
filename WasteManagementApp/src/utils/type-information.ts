import { DirectionsResponseData } from "@googlemaps/google-maps-services-js/dist/directions";

export type SmartBinsJSON = {
    type: string,
    name: string,
    features: {
        type: string,
        geometry: {
            type: string,
            coordinates: [number, number]
        },
        properties: {
            bin_detail: string,
            capacity: number,
            fullness_threshold: number,
            position: string,
            status: string,
            serial_number: number,
            last_updated: string
        }
    }[]
};

export type SmartBinsCurrentFillLevelsJSON = {
    type: string,
    name: string,
    features: {
        type: string,
        geometry: {
            type: string,
            coordinates: [number, number]
        },
        properties: {
            age_thres: number,
            bin_detail: string,
            fill_thres: number,
            fill_lvl: number,
            lat: string,
            lon: string,
            position: string,
            status: string,
            serial_num: number,
            station_num: number,
            timestamp: string
        }
    }[]
};

export type SmartBinInfo = {
    _id?: string,
    serialNumber: number,
    location: {
        type: string,
        coordinates: [number, number]
    },
    address: string,
    capacity: number,
    threshold: number,
    lastUpdated: Date
}

export type BinDeleteInfo = string;
export type BinCreateInfo = {
    _id: string,
    longitude: number,
    latitude: number,
    address: string,
    capacity: number,
    serialNumber?: number,
    threshold?: number,
    lastUpdated?: Date
};
export type BinUpdateInfo = {
    _id: string,
    longitude: number,
    latitude: number,
    address: string,
    capacity: number,
    threshold?: number,
    lastUpdated?: Date
};

export type DeletedBinInfo = string;
export type CreatedBinInfo = {
    _id: string,
    longitude: number,
    latitude: number,
};
export type UpdatedBinInfo = CreatedBinInfo;
export type DepotInfo = CreatedBinInfo;

export type BinDistanceInfo = {
    origin: string;
    originType: string;
    destination: string;
    destinationType: string;
    distance: number;
    duration: number;
};
export type BinCollectionScheduleInfo = {
    routes: {
        vehicle: string;
        directions: DirectionsResponseData[];
    }[];
    timestamp: Date;
};

export type SmartBinCollectInfo = {
    _id: string,
    longitude: number,
    latitude: number,
    volume: number
};
export type DumbBinCollectInfo = SmartBinCollectInfo;
export type DepotCollectInfo = SmartBinCollectInfo;
export type FleetVehicleCollectInfo = {
    _id: string,
    capacity: number
};

export type FleetVehicleDeleteInfo = string;
export type FleetVehicleCreateInfo = {
    rego: string,
    capacity: number,
    available: boolean,
    icon: number,
    homeDepot?: string
};
export type FleetVehicleUpdateInfo = {
    _id: string,
    rego: string,
    capacity: number,
    available: boolean,
    icon: number,
    homeDepot?: string
};

export type mongooseInsertWriteOpResult = {
    insertedCount: number,
    ops: object[],
    insertedIds: {
        [index: number]: string
    }[],
    connection: object,
    result?: {
        ok: number,
        n: number
    }
}

export interface LatLng {
    latitude: number,
    longitude: number
};
export interface IdLatLng extends LatLng {
    _id: string
}

export type DistanceMatrixElement = {
    distance: number,
    duration: number
}
