export type SmartBinsInfo = {
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
            fullness_threshold: number,
            position: string,
            status: string,
            serial_number: number,
            last_updated: string
        }
    }[]
};

export type SmartBinsCurrentFillLevelsInfo = {
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

export type DumbBinDeleteInfo = string;
export type DumbBinCreateInfo = {
    longitude: number,
    latitude: number,
    address: string,
    capacity: number
};
export type DumbBinUpdateInfo = {
    _id: string,
    longitude: number,
    latitude: number,
    address: number,
    capacity: number
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

export type FleetVehicleDeleteInfo = string;
export type FleetVehicleCreateInfo = {
    rego: string,
    capacity: number,
    available: boolean,
    icon: number,
    belongTo?: string
};
export type FleetVehicleUpdateInfo = {
    _id: string,
    rego: string,
    capacity: number,
    available: boolean,
    icon: number,
    belongTo?: string
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
