import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";
import { switchApplicationView } from "./loader.js";
import { initStartScreen } from "./Start.js";
import { initExploreModeSettings } from "./mode-explore-settings.js";
import { initRoadMode } from "./mode-road.js";
import { initExplorerMenu } from "./mode-explore-menu.js";

//Constants
const statusMount = document.getElementById("status-text");
const announcementsMount = document.getElementById("announcements-mount");

/**
 * Reverse-geocodes a lat/lon coordinate into a human-readable address string
 * using the Nominatim API. Falls back to raw coordinates on failure.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}  "Current Location: <address>" or "Current Location: <lat>, <lon>"
 */
export const reportCurrentLocation= async (lat, lon) => {
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

export const exploreNewLocation = () => {
        const url = location.origin + location.pathname;
        history.replaceState({}, "", url);
        state.current_heading = 0;
        state.current_moving_distance = 91.44;
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
    };

export const switchToRoadMode = () => {
        switchApplicationView(
            "pages/mode-road.html",
            document.getElementById("app-mount"),
            initRoadMode
        );
    };

    export const openSettings = () => {
            switchApplicationView(
                "pages/mode-explore-settings.html",
                document.getElementById("app-mount"),
                initExploreModeSettings
            );
        };

export const movePrevious = async () => {
        if (state.location_history.length === 0) {
        Utils.srAnnounce(announcementsMount, `<p>There are no previous points. Navigate using the turn buttons  to explore freely and create previous points.</p>`);
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
       Utils.srAnnounce(statusMount, newCurrentLocation);
       Utils.srAnnounce(announcementsMount, announcements);
    };

    export const turnLeft = () => {
            state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
            Utils.srAnnounce(announcementsMount, `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}</p>`);
    };
    
    export const moveForward = async () => {
            state.location_history.push({ lat: state.lat, lon: state.lon, intersection: null });
    
            const { lat: newLat, lon: newLon } = Utils.move(
                state.lat, state.lon,
                state.current_moving_distance, state.current_heading
            );
            state.lat = newLat;
            state.lon = newLon;
    
            const description = await reportCurrentLocation(state.lat, state.lon);
            Utils.srAnnounce(statusMount, `${description}`);
            Utils.srAnnounce(announcementsMount, `<p>Moved ${Utils.printDistance(state.current_moving_distance)} ${Utils.getCardinalDirection(state.current_heading)}.</p>`);
    
            const url = `?mode=explore&coords=${newLat},${newLon}`;
            history.pushState({}, "", url);
    };

    export const turnRight = () => {
            state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
            Utils.srAnnounce(announcementsMount, `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}</p>`);
    };

    export const turnAround = () => {
            state.current_heading = Utils.updateHeading(state.current_heading + 180);
            Utils.srAnnounce(announcementsMount, `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}.</p>`);
        };

export const zoomIn = () => {
        // Halve movement distance, floor at 1 meter
        state.current_moving_distance = Math.max(1, state.current_moving_distance / 2);
        Utils.srAnnounce(announcementsMount,`<p>Zoomed in to ${Utils.printDistance(state.current_moving_distance)}</p>`);
    };

export const zoomOut = () => {
        // Double movement distance, cap at ~1000 miles (1,609,000 meters)
        state.current_moving_distance = Math.min(state.current_moving_distance * 2, 1609000);
        Utils.srAnnounce(announcementsMount, `<p>Zoomed out to ${Utils.printDistance(state.current_moving_distance)}</p>`);
    };

    export const toggleMenu = (e) => {
    const menu = document.getElementById("menu");
    const isHidden = (menu.hidden === true);
    e.currentTarget.setAttribute("aria-expanded", String(isHidden));
    menu.hidden = !isHidden;
  };
