import express from "express";
import SmartBin from "../models/smart-bin";
import DumbBin from "../models/dumb-bin";
import * as HTTP from "../constants/http"

export function getBins(request: express.Request, response: express.Response) {
    Promise.all([
        SmartBin.find({}),
        DumbBin.find({})
    ])
    .then(([smartBins, dumbBins]) => 
        response.status(HTTP.OK).json({
            bins: (smartBins.map((smartBin: any) => ({
                _id: smartBin._id,
                serial_number: smartBin.serial_number,
                longitude: smartBin.location.coordinates[0],
                latitude: smartBin.location.coordinates[1],
                address: smartBin.address,
                capacity: smartBin.capacity,
                threshold: smartBin.threshold,
                currentFullness: smartBin.currentFullness,
                isSmart: true
            })) as any[]).concat(dumbBins.map((dumbBin: any) => ({
                _id: dumbBin._id,
                longitude: dumbBin.location.coordinates[0],
                latitude: dumbBin.location.coordinates[1],
                address: dumbBin.address,
                capacity: dumbBin.capacity,
                isSmart: false
            })))
        })
    )
    .catch((error) => console.error(error));
}
