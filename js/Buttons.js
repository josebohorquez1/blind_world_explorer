//File for all button events

import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";
import * as Map from "./Map.js";

//Function wrapper for all button event to easily export them
export const initButtons = () => {
    //Change mode button
    document.getElementById("changeModeButton").addEventListener("click", async (e) => {
        state.is_road_mode = !state.is_road_mode;
        if (state.is_road_mode) {
            e.target.textContent = "Change to Explorer Mode";
            document.querySelectorAll("#openMovementSettingsButton, #zoomButtons button").forEach(el => {
                el.disabled = true;
                el.textContent += `: Disabled during road mode.`;
            });
            let announcements = "";
            announcements += `<p>Changed mode to road mode. You will now be able to navigate by road.</p>`;
            await state.intersection_graph.loadFromCoords(state.lat, state.lon);
            //1. Find and announce closest intersection
            const closestIntersection = state.intersection_graph.getNearestIntersection(state.lat, state.lon);
            console.log(closestIntersection);
            if (!closestIntersection) {
                announcements += `<p>Unable to be placed on a road. Returning to free explore mode.</p>`;
                Utils.srAnnounce(document.getElementById("announcements"), announcements);
            e.target.textContent = "Change to Road Mode";
            Utils.srAnnounce(document.getElementById("announcements"), `<p> ${ await Utils.updateStatus(state.lat, state.lon)}</p>`);
                        document.querySelectorAll("#openMovementSettingsButton, #zoomButtons button").forEach(el => {
                el.disabled = false;
                const colon_position = el.textContent.indexOf(":");
                el.textContent = el.textContent.substring(0, colon_position);
            }); 
            }
            announcements += `<p>Current intersection: ${closestIntersection.description}</p>`;
            //2. Align on a street using the closest angle difference from the current bearing and announce.
            const closestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(state.current_heading, closestIntersection);
            state.current_heading = Utils.updateHeading(Math.round(closestNeighbor.angle));
            const closestStreet = closestNeighbor.street
            announcements += `
            <p>Heading ${closestNeighbor.cardinal} on ${closestStreet.label}</p>`;
            //Update current road
            state.current_intersection = closestIntersection;
            state.current_road = closestStreet;
            state.lat = closestIntersection.lat;
            state.lon = closestIntersection.lon;
            //3. Find next intersection based on the selected segment along with the distance and announce it.
            const nextIntersection = closestNeighbor.intersection;
            state.next_intersection = nextIntersection;
            const distance = Utils.calculateDistanceBetweenCordinates(closestIntersection.lat, closestIntersection.lon, nextIntersection.lat, nextIntersection.lon);
            announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(distance)} away.</p>`;
            //Finish by announcing
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
        else {
            e.target.textContent = "Change to Road Mode";
            Utils.srAnnounce(document.getElementById("announcements"), `<p> ${await Utils.updateStatus(state.lat, state.lon)}</p>`);
                        document.querySelectorAll("#openMovementSettingsButton, #zoomButtons button").forEach(el => {
                el.disabled = false;
                const colon_position = el.textContent.indexOf(":");
                el.textContent = el.textContent.substring(0, colon_position);
            });
        }
    });

    //Turn buttons
    document.querySelector("#turnLeft").addEventListener("click", async () => {
        if (!state.is_road_mode) {
            state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
            Utils.srAnnounce(document.getElementById("announcements"), `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>`);
        }
        else {
            let announcements = "";
            //1. Select the edge based on the clock direction.
            const newNeighbor = state.intersection_graph.getLeftTurn(state.current_intersection.id, state.current_heading);
            state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
            state.current_road = newNeighbor.street;
            //2. Announce turn and next intersection along with distance.
            announcements += `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>`;
            const nextIntersection = newNeighbor.intersection;
            state.next_intersection = nextIntersection;
            const distance = Utils.calculateDistanceBetweenCordinates(state.current_intersection.lat, state.current_intersection.lon, nextIntersection.lat, nextIntersection.lon);
            announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(distance)} away.</p>`;
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
    });
    document.querySelector("#turnRight").addEventListener("click", async () => {
        if (!state.is_road_mode) {
            state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
            Utils.srAnnounce(document.getElementById("announcements"), `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>`);
        }
        else {
            let announcements = "";
            //1. Select the edge based on the clock direction.
            const newNeighbor = state.intersection_graph.getRightTurn(state.current_intersection.id, state.current_heading);
            state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
            state.current_road = newNeighbor.street;
            //2. Announce turn and next intersection along with distance.
            announcements += `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>`;
            const nextIntersection = newNeighbor.intersection;
            state.next_intersection = nextIntersection;
            const distance = Utils.calculateDistanceBetweenCordinates(state.current_intersection.lat, state.current_intersection.lon, nextIntersection.lat, nextIntersection.lon);
            announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(distance)} away.</p>`;
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
    });
    document.getElementById("turnAround").addEventListener("click", () => state.current_heading = Utils.updateHeading(state.current_heading + 180));
    document.querySelector("#go").addEventListener("click", async () => {
        if (!state.is_road_mode) {
            state.location_history.push({lat: state.lat, lon: state.lon});
        const {lat: new_lat, lon: new_lon} = Utils.move(state.lat, state.lon, state.current_moving_distance, state.current_heading);
        state.lat = new_lat;
        state.lon = new_lon;
            const description = await Utils.updateStatus(state.lat, state.lon);
        Utils.srAnnounce(document.querySelector("#announcements"), `<p>${description}</p>
        <p>Moved ${Utils.printDistance(state.current_moving_distance)} ${state.directions[Math.round(state.current_heading / 45) % 8]}.</p>`);
        }
        else {
            let announcements = "";
            state.location_history.push({lat: state.lat, lon: state.lon});
            //1. Find current intersection, next intersection, and then move to the new location.
            const newCurrentIntersection = state.next_intersection;
            const newNeighbor = state.intersection_graph.closestNeighborByAngularDiff(state.current_heading, newCurrentIntersection);
            const newNextIntersection = newNeighbor.intersection;
            state.lat = newCurrentIntersection.lat;
            state.lon = newCurrentIntersection.lon;
            //2. Announce new intersection along with distance moved.
            const distance = Utils.calculateDistanceBetweenCordinates(state.current_intersection.lat, state.current_intersection.lon, newCurrentIntersection.lat, newCurrentIntersection.lon);
            announcements += `<p>Moved ${Utils.printDistance(distance)} ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>
            <p>Current intersection: ${newCurrentIntersection.description}.</p>
            <p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}.</p>`;
            state.current_intersection = newCurrentIntersection;
            state.next_intersection = newNextIntersection;
            //3. Announce upcoming intersection and distance
            const upcomingDistance = Utils.calculateDistanceBetweenCordinates(newCurrentIntersection.lat, newCurrentIntersection.lon, newNextIntersection.lat, newNextIntersection.lon);
            announcements += `<p>Next intersection: ${newNextIntersection.description} ${Utils.printDistance(upcomingDistance)}  away.</p>`;
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
    });
    document.getElementById("returnPrevious").addEventListener("click", () => {
        if (state.location_history.length == 0) {
            Utils.srAnnounce(document.querySelector("#announcement"), `Cannot return to previous point.`);
            return;
        }
        const last_point = state.location_history[state.location_history.length - 1];
        const old_lat = state.lat;
        const old_lon = state.lon;
        state.lat = last_point.lat;
        state.lon = last_point.lon;
        state.location_history.pop();
        Utils.updateStatus(state.lat, state.lon);
        Utils.srAnnounce(document.querySelector("#announcement"), `Moved ${Utils.printDistance(Utils.calculateDistanceBetweenCordinates(old_lat, old_lon, state.lat, state.lon))} ${state.directions[Math.round(Utils.getBearing(old_lat, old_lon, state.lat, state.lon) / 45) % 8]}.`);
    });
    //Zoom Buttons
    document.getElementById("zoomIn").addEventListener("click", () => {
        state.current_moving_distance = Math.max(1, state.current_moving_distance / 2);
        Utils.srAnnounce(document.querySelector("#announcement"), `Zoomed in to ${Utils.printDistance(state.current_moving_distance)}`);
    });
    document.getElementById("zoomOut").addEventListener("click", () => {
        state.current_moving_distance = Math.min(state.current_moving_distance * 2, 1609000);
        Utils.srAnnounce(document.querySelector("#announcement"), `Zoomed out to ${Utils.printDistance(state.current_moving_distance)}`);
    });
};
