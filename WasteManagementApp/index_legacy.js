const {Client, Status} = require("@googlemaps/google-maps-services-js");

const client = new Client({});

server.get('/heatmap', function(response) {
    response.coordinates = [{lat:xxx, lng:xxx, threshold:8, currentFillingLevel:7}]
})

server.post('/addBin', function(request, response) {
    request.j
})

client.
    distancematrix({
        method: "GET",
        params: {
            origins: [
                {
                    lat: -37.9013174885296,
                    lng: 144.661149490102,
                },
            ],
            destinations: [
                {
                    lat: -37.8825216694184,
                    lng: 144.735623333276
                }
            ],
            key: "AIzaSyBXGSkcXs29Uy-FDz8H9Z_GXf4vbW4-qHw",
        },
        timeout: 1000, // milliseconds
    })
    .then((r) => {
        console.log(r.data.rows[0].elements[0]);
    })
    .catch((e) => {
        console.log(e.response.data.error_message);
    });