//Import modules
import { state } from "./state.js"; //Holds the variables
import* as Utils from "./UtilFunctions.js"; //Holds the utility functions
import { initSearchEvent } from "./Search.js"; //Contains the search functionality
import { initSettingsEvents } from "./Settings.js"; //Holds the events for the different settings
import { initButtons } from "./Buttons.js"; //Contains the button events

//Code will fire upon page load
document.addEventListener("DOMContentLoaded", () => {
    let best_position = null; //Holds the best position if current location is allowed
    let watch_position_id = null; //Hold the wat position id
    if (navigator.geolocation) { //Does browser support geolocation?
    watch_position_id = navigator.geolocation.watchPosition((position) => { 
        document.querySelectorAll("button, input, select").forEach(el => el.disabled = true);
        const {latitude, longitude, accuracy} = position.coords;
        if (!best_position || accuracy < best_position.coords.accuracy) best_position = position;
    }, (err) => {
        state.lat = 40.7128;
        state.lon = -74.0060;
        Utils.updateStatus(lat, lon);
    }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 1000
    });
    setTimeout(() => { //clear watch position after 10 seconds
        if (watch_position_id) navigator.geolocation.clearWatch(watch_position_id);
        if (best_position) {
            const {latitude, longitude, accuracy} = best_position.coords;
            Utils.updateStatus(latitude, longitude);
            state.lat = latitude;
            state.lon = longitude;
        }
        document.querySelectorAll("button, input, select").forEach(el => el.disabled = false);
    }, 10000);
    }
    else {
        state.lat = 40.7128;
        state.lon = -74.0060;
        Utils.updateStatus(lat, lon);
    }
    state.current_heading = Utils.updateHeading(state.current_heading);
    initSearchEvent() //Initializes search functionality
    initSettingsEvents() //Initializes settings events
    initButtons(); //Initializes button events
});