import express from "express";
import path from "path";

const app = express();

// For this project served as a proof of concept, we use the current fill level
// dataset as the main dataset for bins' information
// Assume in production environment, there will be another database storing all the
// bins' data with timestamps indicating when they are last updated, and this server 
// is mainly used for sending the data that has been manually modifed to that format
// to the main application for smart bins' information
const options = {
    root: path.join(__dirname, "../public")
}

app.get("/smart_bins", function(request, response) {
    response.sendFile("/assets/json/smart_bins.json", options);
});

app.get("/smart_bins_current_fill_levels", function(request, response) {
    response.sendFile("/assets/json/smart_bins_current_fill_levels.json", options);
});

app.listen(8081);
