//Import modules
import { state } from "./state.js"; //Holds the variables
import* as Utils from "./UtilFunctions.js"; //Holds the utility functions
import * as Map from "./Map.js"; //Holds the map data functions
import { initStartScreen } from "./Start.js";
import { coordsScreenEvents } from "./start-coords.js";
//import { initSearchEvent } from "./Search.js"; //Contains the search functionality
//import { initSettingsEvents } from "./Settings.js"; //Holds the events for the different settings
//import { initButtons } from "./Buttons.js"; //Contains the button events
import { switchApplicationView } from "./loader.js"; //The application loader.
import { initExploreMode } from "./mode-explore.js";
import { initRoadMode } from "./mode-road.js";

//Code will fire upon page load
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode");
    const coords = params.get("coords");
    if (mode && coords) {
        const [lat, lon] = coords.split(",");
        if (mode === "explore" && lat && lon) {
            state.lat = parseFloat(lat);
            state.lon = parseFloat(lon);
            switchApplicationView(
                "pages/mode-explore.html",
                document.getElementById("app-mount"),
                initExploreMode
            );
        }
        if (mode === "road" && lat && lon) {
            state.lat = parseFloat(lat);
            state.lon = parseFloat(lon);
            console.log(`${state.lat, state.lon}`);
            switchApplicationView(
                "pages/mode-road.html",
                document.getElementById("app-mount"),
                initRoadMode
            );
        }
    }
    else {
    //Load the start screen
    switchApplicationView(
        "pages/start.html",
        document.getElementById("app-mount"),
        initStartScreen
    );
    }
    //Render initial lucide icons if available
    if (window.lucide) lucide.createIcons();
});