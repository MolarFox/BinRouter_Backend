import { GoogleMapsServicesAdapter } from "../google-maps-services-adapter";
import { expect } from "chai";

describe("GoogleMapsServicesAdapter", function() {
    const googleMapsServicesAdapter: GoogleMapsServicesAdapter = new GoogleMapsServicesAdapter();

    before("initialise the environment", function() {
        process.env.GOOGLE_MAPS_API_KEY = "AIzaSyD2XBXROlPbiqozvTPTtH_gQRPs-qx6t6A";
    });

    describe("#computeDistanceMatrix", function() {
        it("should return an empty array", async function() {
            const actualResult = await googleMapsServicesAdapter.computeDistanceMatrix([], []);
            expect(actualResult).to.be.an("array");
            expect(actualResult.length).to.equal(0);
        });

        it("should return a 1 x 1 distance matrix whose only element contains a distance of 0 and a duration of 0", async function() {
            const origins = [{
                longitude: 145.1275,
                latitude: -37.907803
            }];
            const destinations = origins;
            const expectedResult = {
                distance: 0,
                duration: 0
            };
            const actualResult = await googleMapsServicesAdapter.computeDistanceMatrix(origins, destinations);
            expect(actualResult.length).to.equal(1);
            expect(actualResult[0].length).to.equal(1);
            expect(actualResult[0][0]).to.deep.equal(expectedResult);
        });

        it("should return a 1 x 1 distance matrix whose only element contains a distance of -1 and a duration of -1", async function() {
            const origins = [{
                latitude: 145.1275,
                longitude: -37.907803
            }];
            const destinations = origins;
            const expectedResult = {
                distance: -1,
                duration: -1
            };
            const actualResult = await googleMapsServicesAdapter.computeDistanceMatrix(origins, destinations);
            expect(actualResult.length).to.equal(1);
            expect(actualResult[0].length).to.equal(1);
            expect(actualResult[0][0]).to.deep.equal(expectedResult);
        });
        
        it("should return a 1 x 1 distance matrix whose only element contains a distance of neither 0 nor -1 and a duration of neither 0 nor -1", async function() {
            const origins = [{
                longitude: 145.1275,
                latitude: -37.907803
            }];
            const destinations = [{
                longitude: 145.045837,
                latitude: -37.876823
            }];
            const actualResult = await googleMapsServicesAdapter.computeDistanceMatrix(origins, destinations);
            expect(actualResult.length).to.equal(1);
            expect(actualResult[0].length).to.equal(1);
            expect(actualResult[0][0].distance).to.not.equal(0).and.not.equal(-1);
            expect(actualResult[0][0].duration).to.not.equal(0).and.not.equal(-1);
        });

        it("should return a 26 * 26 distance matrix whose elements all contain a distance of neither 0 nor -1 and a duration of neither 0 nor -1", async function() {
            const origins = new Array(26).fill({
                longitude: 145.1275,
                latitude: -37.907803
            });
            const destinations = new Array(26).fill({
                longitude: 145.045837,
                latitude: -37.876823
            });
            const actualResult = await googleMapsServicesAdapter.computeDistanceMatrix(origins, destinations);
            expect(actualResult.length).to.equal(26);
            expect(actualResult[0].length).to.equal(26);
            for (let i = 0; i < 26; i++) {
                for (let j = 0; j < 26; j++) {
                    expect(actualResult[i][j].distance).to.not.equal(0).and.not.equal(-1);
                    expect(actualResult[i][j].duration).to.not.equal(0).and.not.equal(-1);
                }
            }
        }).timeout(5000);
    });
});
