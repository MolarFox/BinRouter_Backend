import { BIN_SEARCH_DISTANCE } from "../constants/misc";
import SmartBin from "../models/smart-bin";
import { LatLng } from "./type-information";

export class BinHelper {
    public static computeNearestSmartBins(
        dumbBins: LatLng[]
    ): Promise<(string | null)[]> {
        return Promise.all(
            dumbBins.map(async (dumbBin) => 
                (await SmartBin.findOne(
                    {
                        location: {
                            $near: {
                                $geometry: {
                                    type: "Point",
                                    coordinates: [dumbBin.longitude, dumbBin.latitude]
                                },
                                $maxDistance: BIN_SEARCH_DISTANCE
                            }
                        }
                    },
                    "_id"
                ))?._id
            )
        );
    }
}
