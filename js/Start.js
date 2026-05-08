//File to store start screen buttons functionality
//Import modules
import {state} from "./state.js";
import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { coordsScreenEvents } from "./start-coords.js";
import { initSearchEvents } from "./start-search.js";
import { initExploreMode } from "./mode-explore.js";

//Wrapper function to hold the start screen buttons functionality
export const initStartScreen = () => {
    lucide.createIcons();
    
    document.getElementById("explore-current").addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition( async (pos) => {
                state.lat = pos.coords.latitude;
                state.lon = pos.coords.longitude;
                switchApplicationView(
                    "pages/mode-explore.html",
                    document.getElementById("app-mount"),
                    initExploreMode
                );
            },
            () => {
                Utils.srAnnounce(
                    document.getElementById("status-text"),
                    `Error: unable to get current location. Try one of the other actions instead.`
                );
            },
            {enableHighAccuracy: true}
        );
        }
        else {
            Utils.srAnnounce(
                document.getElementById("status-text"),
                `Browser does not support geolocation. Try one of the other actions instead.`
            );
        }
    });

    document.getElementById("explore-coords").addEventListener("click", () => {
        switchApplicationView(
            "pages/start-coords.html",
            document.getElementById("app-mount"),
                coordsScreenEvents
        );
    });

    document.getElementById("explore-search").addEventListener("click", () => {
        switchApplicationView(
            "pages/start-search.html",
            document.getElementById("app-mount"),
            initSearchEvents
        );
    });

    /** @type {Map<string, {lat: number, lon: number}} */
    const cities = new Map();
    cities.set(
        "explore-nyc",
        {lat: 40.7685, lon: -73.9822}
    );
    cities.set(
        "explore-london",
        {lat: 51.5072, lon: -0.1276}
    );
    cities.set(
        "explore-cairo",
        {lat: 30.0444, lon: 31.2357}
    );
    cities.set(
        "explore-sp",
        {lat: -23.5558, lon: -46.6396}
    );
    cities.set(
        "explore-tokyo",
        {lat: 35.6764, lon: 139.6500}
    );
    cities.set(
        "explore-sydney",
        {lat: -33.8623, lon: 151.2077}
    );
    for (const [cityId, coords] of cities.entries()) {
        document.getElementById(cityId).addEventListener("click", async () => {
        state.lat = coords.lat;
        state.lon = coords.lon;
        switchApplicationView(
            "pages/mode-explore.html",
            document.getElementById("app-mount"),
            initExploreMode
        );
        });
    }
};
