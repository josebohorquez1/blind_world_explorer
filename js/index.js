//Import modules
import { state } from "./state.js"; //Holds the variables
import* as Utils from "./UtilFunctions.js"; //Holds the utility functions
import * as Map from "./Map.js"; //Holds the map data functions
import { initSearchEvent } from "./Search.js"; //Contains the search functionality
import { initSettingsEvents } from "./Settings.js"; //Holds the events for the different settings
import { initButtons } from "./Buttons.js"; //Contains the button events

//Code will fire upon page load
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("option_currentLocation").addEventListener("click", () => {
        if (navigator.geolocation) { //Does browser support geolocation?
            navigator.geolocation.getCurrentPosition((position) => { 
            const {latitude, longitude, accuracy} = position.coords;
            state.lat = latitude;
            state.lon = longitude;
            document.querySelector("#startScreen").style.display = "none";
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
        document.querySelector("#startScreen").style.display = "none";
        document.querySelectorAll("#mainScreen, #tabBar").forEach(el => el.classList.add("active"));
        state.current_heading = Utils.updateHeading(state.current_heading);
        Utils.updateStatus(state.lat, state.lon);
    });
    initSearchEvent() //Initializes search functionality
    initSettingsEvents() //Initializes settings events
    initButtons(); //Initializes button events
});