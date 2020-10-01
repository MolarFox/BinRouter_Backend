import express from "express";
import mongoose from "mongoose";
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

export function modifyBins(request: express.Request, response: express.Response) {
    const dumbBinsDelete: any[] = Array.isArray(request.body.dumbBinsDelete) ? request.body.dumbBinsDelete : [];
    const dumbBinsCreate: any[] = Array.isArray(request.body.dumbBinsCreate) ? request.body.dumbBinsCreate : [];
    const dumbBinsUpdate: any[] = Array.isArray(request.body.dumbBinsUpdate) ? request.body.dumbBinsUpdate : [];

    const dumbBinsDeleteBulkOperations = dumbBinsDelete.map((_id: string) => ({
        deleteOne: {
            filter: { 
                _id: _id
            }
        }
    }));
    const dumbBinsCreateBulkOperations = dumbBinsCreate.map((dumbBin: any) => ({
        insertOne: {
            document: {
                _id: new mongoose.Types.ObjectId(),
                location: {
                    type: "Point",
                    coordinates: [dumbBin.longitude as number, dumbBin.latitude as number]
                },
                address: dumbBin.address as string,
                capacity: dumbBin.capacity as number,
            }
        }
    }));
    const dumbBinsUpdateBulkOperations = dumbBinsUpdate.map((dumbBin: any) => ({
        updateOne: {
            filter: {
                _id: dumbBin._id as string,
            },
            update: {
                location: {
                    type: "Point",
                    coordinates: [dumbBin.longitude as number, dumbBin.latitude as number]
                },
                address: dumbBin.address as string,
                capacity: dumbBin.capacity as number,
                nearestSmartBin: undefined
            }
        }
    }));

    DumbBin
        .bulkWrite((dumbBinsDeleteBulkOperations as any[]).concat(dumbBinsCreateBulkOperations).concat(dumbBinsUpdateBulkOperations))
        .then((bulkWriteOperationResult) => {
            if (bulkWriteOperationResult.result && bulkWriteOperationResult.result.ok === 1 && bulkWriteOperationResult.result.writeErrors.length === 0) {
                response.status(HTTP.CREATED).send(bulkWriteOperationResult.insertedIds);
                // Recompute the bin distances using google maps computeDistanceMatrix
            } else {
                response.status(HTTP.BAD_REQUEST).send(bulkWriteOperationResult.result.writeErrors);
                return Promise.reject(bulkWriteOperationResult.result);
            }
        })
        // Chain another then for resolving promise of recomputation of bin distances
        .catch((error) => {
            console.error(error);
            response.status(HTTP.BAD_REQUEST).send(error.writeErrors);
        });

    if (dumbBinsCreate.length > 0 || dumbBinsDelete.length > 0 || dumbBinsUpdate.length > 0) {
        // Recompute the route by calling the recomputation routine
    }
}
