//File to store start screen buttons functionality
//Import modules
import {state} from "./state.js";
import * as Map from "./Map.js"
import * as Utils from "./UtilFunctions.js";

//Wrapper function to hold the start screen buttons functionality
export const initStartScreen = () => {
    document.getElementById("option_currentLocation").addEventListener("click", () => {
        if (navigator.geolocation) { //Does browser support geolocation?
            navigator.geolocation.getCurrentPosition((position) => { 
            const {latitude, longitude, accuracy} = position.coords;
            state.lat = latitude;
            state.lon = longitude;
            document.querySelector("#startScreen").classList.remove("active");
            document.querySelectorAll("#mainScreen, #tabBar").forEach(el => el.classList.add("active"));
            state.current_heading = Utils.updateHeading(state.current_heading);
            Utils.updateStatus(state.lat, state.lon);
        }, (err) => {
            Utils.srAnnounce(document.getElementById("startScreenError"), `Error: Could not get current location. Choose another option.`);
            return;
        }, {
            enableHighAccuracy: true,
        });
    }
    else {
        Utils.srAnnounce(document.getElementById("startScreenError"), `Error: Browser does not support getting current location.`);
        return;
    }
    });
    document.getElementById("option_default").addEventListener("click", () => {
        state.lat = 40.7128;
        state.lon = -74.0060;
        document.querySelector("#startScreen").classList.remove("active");
        document.querySelectorAll("#mainScreen, #tabBar").forEach(el => el.classList.add("active"));
        state.current_heading = Utils.updateHeading(state.current_heading);
        Utils.updateStatus(state.lat, state.lon);
    });
    document.getElementById("option_coords").addEventListener("click", () => {
        const input = prompt(`Enter location coordinates. Examples include 29.333,21.44 or -29.777,-82.444`);
        if (!input || !input.trim()) {
            Utils.srAnnounce(document.getElementById("startScreenError"), `Error: No coordinates entered.`);
            return;
        }
        const parts = input.split(",").map(s => s.trim());
        if (parts.length !== 2) {
            Utils.srAnnounce(document.getElementById("startScreenError"), `Error: Please enter coordinates in the valid format "lat,lon".`);
            return;
        }
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lon)) {
            Utils.srAnnounce(document.getElementById("startScreenError"), `Error: Invalid coordinates. Please enter coordinates like "29.000,81.222".`);
            return;
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            Utils.srAnnounce(document.getElementById("startScreenError"), `Error: Coordinates out of range. Latitude must be -90 to 90, longitude -180 to 180.`);
            return;
        }
        state.lat = lat;
        state.lon = lon;
        document.querySelector("#startScreen").classList.remove("active");
        document.querySelectorAll("#mainScreen, #tabBar").forEach(el => el.classList.add("active"));
        state.current_heading = Utils.updateHeading(state.current_heading);
        Utils.updateStatus(state.lat, state.lon);
    });
}
