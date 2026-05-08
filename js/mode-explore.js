import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { state } from "./state.js";
import { initStartScreen } from "./Start.js";
import { initExploreModeSettings } from "./mode-explore-settings.js";

export const initExploreMode = () => {
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    Utils.sleep(100).then(() => 
    document.querySelectorAll("#turn-buttons button")[0].focus());

    document.getElementById("nav-new-location").addEventListener("click", () => {
        const url = location.origin;
        history.replaceState({}, "", url) + location.pathname;
        switchApplicationView(
            "pages/start.html",
            document.getElementById("app-mount"),
            initStartScreen
        );
    });

    //switch road mode

    //settings button
    document.getElementById("nav-settings").addEventListener("click", () => {
        switchApplicationView(
            "pages/mode-explore-settings.html",
            document.getElementById("app-mount"),
            initExploreModeSettings
        );
    });

    document.getElementById("btn-previous").addEventListener("click", async () => {
        if (state.location_history.length === 0) {
        Utils.srAnnounce(
            document.getElementById("announcements-mount"),
            `<p>There are no previous points. Navigate using the turn buttons  to explore freely and create previous points.</p>`
        );
        return;
        }
 
        const lastPoint = state.location_history[state.location_history.length - 1];
        const currentLat = state.lat;
        const currentLon = state.lon;
        const { lat: prevLat, lon: prevLon, intersection: prevIntersection } = lastPoint;
 
        let announcements = "";
 
       // Explorer mode: restore raw coordinates and describe displacement from current position
       state.lat = prevLat;
       state.lon = prevLon;
 
       const distanceMoved = Utils.calculateDistanceBetweenCordinates(currentLat, currentLon, prevLat, prevLon);
       const bearingToPrev = Utils.getBearingAndDirection(currentLat, currentLon, prevLat, prevLon);
 
       const newCurrentLocation = `${await Utils.reportCurrentLocation(prevLat, prevLon)}.`;
       announcements += `<p>Moved ${Utils.printDistance(distanceMoved)} ${bearingToPrev.cardinal}.</p>`;
 
       state.location_history.pop();
       Utils.srAnnounce(
        document.getElementById("status-text"),
        newCurrentLocation
       );
       Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
    });
    
    document.getElementById("btn-turn-left").addEventListener("click", async () => {
        state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
        Utils.srAnnounce(
            document.getElementById("announcements-mount"),
            `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}</p>`
        );
});

    document.getElementById("btn-go").addEventListener("click", async () => {
        state.location_history.push({ lat: state.lat, lon: state.lon, intersection: null });

        const { lat: newLat, lon: newLon } = Utils.move(
            state.lat, state.lon,
            state.current_moving_distance,
            state.current_heading
        );
        state.lat = newLat;
        state.lon = newLon;

        const description = await Utils.reportCurrentLocation(state.lat, state.lon);
        Utils.srAnnounce(
            document.getElementById("status-text"),
            `${description}`
        );
        Utils.srAnnounce(
            document.getElementById("announcements-mount"),
            `<p>Moved ${Utils.printDistance(state.current_moving_distance)} ${Utils.getCardinalDirection(state.current_heading)}.</p>`
        );

        const url = `?mode=explore&coords=${newLat},${newLon}`;
        history.pushState({}, "", url);
});

    document.getElementById("btn-turn-right").addEventListener("click", async () => {
        state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
        Utils.srAnnounce(
            document.getElementById("announcements-mount"),
            `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}</p>`
        );
});

    document.getElementById("btn-turn-around").addEventListener("click", (e) => {
        state.current_heading = Utils.updateHeading(state.current_heading + 180);
        Utils.srAnnounce(
            document.getElementById("announcements"),
            `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}.</p>`
        );
    });

    document.getElementById("zoom-in").addEventListener("click", () => {
        // Halve movement distance, floor at 1 meter
        state.current_moving_distance = Math.max(1, state.current_moving_distance / 2);
        Utils.srAnnounce(
            document.getElementById("announcements-mount"),
            `<p>Zoomed in to ${Utils.printDistance(state.current_moving_distance)}</p>`
        );
    });

    document.getElementById("zoom-out").addEventListener("click", () => {
        // Double movement distance, cap at ~1000 miles (1,609,000 meters)
        state.current_moving_distance = Math.min(state.current_moving_distance * 2, 1609000);
        Utils.srAnnounce(
            document.getElementById("announcements-mount"),
            `<p>Zoomed out to ${Utils.printDistance(state.current_moving_distance)}</p>`
        );
    });
}
