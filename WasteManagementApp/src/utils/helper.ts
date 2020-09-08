export interface SmartBinsInfo {
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
}

export interface SmartBinsCurrentFillLevelsInfo {
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
}
