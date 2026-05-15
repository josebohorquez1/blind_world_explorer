import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { state } from "./state.js";
import { initStartScreen } from "./Start.js";
import { initExploreModeSettings } from "./mode-explore-settings.js";
import { initRoadMode } from "./mode-road.js";
import { initExplorerMenu } from "./mode-explore-menu.js";

/**
 * Reverse-geocodes a lat/lon coordinate into a human-readable address string
 * using the Nominatim API. Falls back to raw coordinates on failure.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}  "Current Location: <address>" or "Current Location: <lat>, <lon>"
 */
const reportCurrentLocation= async (lat, lon) => {
  let description;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );
    const data = await res.json();
    description = data.display_name
      ? `Current Location: ${data.display_name}`
      : `Current Location: ${lat}, ${lon}`;
  } catch {
    description = `Current Location: ${lat}, ${lon}`;
  }
  return description;
};

export const initExploreMode = () => {
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    Utils.sleep(100).then(() => 
    document.querySelector("#turn-buttons button").focus());
    const url = `?mode=explore&coords=${state.lat},${state.lon}`;

    reportCurrentLocation(state.lat, state.lon).then((currentLocationDescription) => {
    Utils.srAnnounce(
        document.getElementById("status-text"),
        `${currentLocationDescription}`
    );
    });

    Utils.sleep(100).then(() => {
    Utils.srAnnounce(
        document.getElementById("announcements-mount"),
         `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}</p>`
    );
    });

    history.pushState({}, "", url);

    document.getElementById("nav-new-location").addEventListener("click", () => {
        const url = location.origin + location.pathname;
        history.replaceState({}, "", url);
        state.current_heading = 0;
        state.current_moving_distance = 90;
        state.current_neighbor = null;
        state.current_rotation_increment = 45;
        state.current_tile = "";
        state.intersection_graph.clear();
        state.lat = 0;
        state.location_history= [];
        state.lon = 0;
        switchApplicationView(
            "pages/start.html",
            document.getElementById("app-mount"),
            initStartScreen
        );
    });

    document.getElementById("nav-road-mode").addEventListener("click", () => {
        switchApplicationView(
            "pages/mode-road.html",
            document.getElementById("app-mount"),
            initRoadMode
        );
    });

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
 
       const newCurrentLocation = `${await reportCurrentLocation(prevLat, prevLon)}.`;
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

        const description = await reportCurrentLocation(state.lat, state.lon);
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
            document.getElementById("announcements-mount"),
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

  document.getElementById("btn-menu").addEventListener("click", (e) => {
    const menu = document.getElementById("menu");
    const isHidden = (menu.hidden === true);
    e.currentTarget.setAttribute("aria-expanded", String(isHidden));
    menu.hidden = !isHidden;
    if (!menu.hidden) initExplorerMenu();
  });
}
