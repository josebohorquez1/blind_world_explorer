//File for all button events

import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";
import * as Map from "./Map.js";

//Function wrapper for all button event to easily export them
export const initButtons = () => {
    //Change mode button
    document.getElementById("changeModeButton").addEventListener("click", async (e) => {
        const returnToExploreMode = async () => {
                        document.querySelectorAll("#openMovementSettingsButton, #zoomButtons button").forEach(el => {
                el.disabled = false;
                const colon_position = el.textContent.indexOf(":");
                el.textContent = el.textContent.substring(0, colon_position);
            }); 
            state.is_road_mode = false;
        };
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
            if (!closestIntersection) {
                announcements += `<p>Unable to be placed on a road. Returning to free explore mode.</p>`;
            e.target.textContent = "Change to Road Mode";
            announcements += `<p> ${ await Utils.updateStatus(state.lat, state.lon)}</p>`;
            Utils.srAnnounce(document.querySelector("#announcements"), announcements);
returnToExploreMode();
            }
            announcements += `<p>Current intersection: ${closestIntersection.description}</p>`;
            //2. Align on a street using the closest angle difference from the current bearing and announce.
            const closestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(state.current_heading, closestIntersection);
            state.current_heading = Utils.updateHeading(Math.round(closestNeighbor.angle));
            const closestStreet = closestNeighbor.street;
            announcements += `
            <p>Heading ${closestNeighbor.cardinal} on ${closestStreet.label}</p>`;
            //Update current road
            state.current_intersection = closestIntersection;
            state.current_road = closestNeighbor;
            state.lat = closestIntersection.lat;
            state.lon = closestIntersection.lon;
            //3. Find next intersection based on the selected segment along with the distance and announce it.
            const nextIntersection = closestNeighbor.intersection;
            state.next_intersection = nextIntersection;
            announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(closestNeighbor.distance)} away.</p>`;
            //Finish by announcing
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
        else {
            e.target.textContent = "Change to Road Mode";
            Utils.srAnnounce(document.getElementById("announcements"), `<p> ${await Utils.updateStatus(state.lat, state.lon)}</p>`);
returnToExploreMode();
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
            state.current_road = newNeighbor;
            //2. Announce turn and next intersection along with distance.
            announcements += `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>`;
            const nextIntersection = newNeighbor.intersection;
            state.next_intersection = nextIntersection;
            announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`;
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
            state.current_road = newNeighbor;
            //2. Announce turn and next intersection along with distance.
            announcements += `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>`;
            const nextIntersection = newNeighbor.intersection;
            state.next_intersection = nextIntersection;
            announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`;
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
    });
    //Update turn around button to handle intersections in road mode.
    document.querySelector("#turnAround").addEventListener("click", (e) => {
        if (!state.is_road_mode) {
            const oldHeading = state.current_heading;
            state.current_heading = Utils.updateHeading(oldHeading + 180);
            Utils.srAnnounce(
                document.getElementById("announcements"),
                `<p>Heading ${state.current_heading} degrees ${state.directions[(Math.round(state.current_heading) / 45 ) % 8]}.</p>`
            );
        }
        else {
            const neighbors = state.intersection_graph.getNeighbors(state.current_intersection.id);
            const neighborsWithSameStreet = neighbors.filter(n => n.street.label === state.current_road.street.label);
            if (neighborsWithSameStreet.length === 1) {
                Utils.srAnnounce(
                    document.getElementById("announcements"),
                    `<p>Unable to turn around: current street only runs in one direction.</p>`
                );
                return;
            }
            const newNeighbor = neighborsWithSameStreet.find(n => 
                state.current_road.street.label === n.street.label
                && state.current_road.angle !== n.angle
            );
            if (newNeighbor === -1) {
                Utils.srAnnounce(
                    document.getElementById("announcements"),
                    `<p>Unable to turn around.</p>`
                );
                return;
            }
            state.current_road = newNeighbor
            Utils.srAnnounce(
                document.getElementById("announcements"),
                `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}
                <p>Next intersection: ${newNeighbor.intersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`
            );
        }
    });
    document.querySelector("#go").addEventListener("click", async () => {
        if (!state.is_road_mode) {
            state.location_history.push({lat: state.lat,
                    lon: state.lon,
                    intersection: null
                });
        const {lat: new_lat, lon: new_lon} = Utils.move(state.lat, state.lon, state.current_moving_distance, state.current_heading);
        state.lat = new_lat;
        state.lon = new_lon;
            const description = await Utils.updateStatus(state.lat, state.lon);
        Utils.srAnnounce(document.querySelector("#announcements"), `<p>${description}</p>
        <p>Moved ${Utils.printDistance(state.current_moving_distance)} ${state.directions[Math.round(state.current_heading / 45) % 8]}.</p>`);
        }
        else {
            let announcements = "";
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
            state.location_history.push({lat: state.lat,
                lon: state.lon,
                intersection: state.current_intersection
            });
            state.current_intersection = newCurrentIntersection;
            state.next_intersection = newNextIntersection;
            state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
            //3. Announce upcoming intersection and distance
            announcements += `<p>Next intersection: ${newNextIntersection.description} ${Utils.printDistance(newNeighbor.distance)}  away.</p>`;
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
    });
    document.getElementById("returnPrevious").addEventListener("click", async () => {
        if (state.location_history.length == 0) {
            Utils.srAnnounce(document.querySelector("#announcements"), `<p>There are no previous points. Navigate to an intersection in road mode or explore freely to create previous points.</p>`);
            return;
        }
        const lastPoint = state.location_history[state.location_history.length - 1];
        const currentLat = state.lat;
        const currentLon = state.lon;
        const {lat: prevLat, lon: prevLon, intersection: prevIntersection} = lastPoint;
        let announcements = "";
        if (state.is_road_mode) {
            if (!prevIntersection) {
                announcements += `<p>The previous point does not contain intersection data. Placing you at the nearest intersection.</p>`;
                const nearestIntersection = state.intersection_graph.getNearestIntersection(prevLat, prevLon);
                announcements += `<p>Current intersection: ${nearestIntersection.description}</p>`;
                const nearestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(Math.round(state.current_heading), nearestIntersection);
                announcements += `<p>Heading ${nearestNeighbor.cardinal} on ${nearestNeighbor.street.label}.</p>`;
                const nextIntersection = nearestNeighbor.intersection;
                announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(nearestNeighbor.distance)} away.</p>`;
                state.lat = prevLat;
                state.lon = prevLon;
                state.current_intersection = nearestIntersection;
                state.next_intersection = nextIntersection;
                state.location_history.pop();
                Utils.srAnnounce(document.querySelector("#announcements"), announcements);
                return;
            }
            announcements += `
            <p>Returning to previously visited intersection.</p>
            <p>Current intersection: ${prevIntersection.description}.</p>
            `;
            const nearestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(Math.round(state.current_heading), prevIntersection);
            announcements += `<p>Heading ${nearestNeighbor.cardinal} on ${nearestNeighbor.street.label}.</p>`;
            const nextIntersection = nearestNeighbor.intersection;
            announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(nearestNeighbor.distance)} away.</p>`;
            state.lat = prevLat;
            state.lon = prevLon;
            state.current_intersection = prevIntersection;
            state.next_intersection = nextIntersection;
            state.location_history.pop();
            Utils.srAnnounce(document.querySelector("#announcements"), announcements);
        }
        else {
            state.lat = prevLat;
            state.lon = prevLon;
            announcements += `<p>${await Utils.updateStatus(prevLat, prevLon)}.</p>`;
            announcements += `<p>Moved ${Utils.printDistance(Utils.calculateDistanceBetweenCordinates(currentLat, currentLon, prevLat, prevLon))} ${state.directions[Math.round(Utils.getBearing(currentLat, currentLon, prevLat, prevLon) / 45) % 8]}.</p>`
            state.location_history.pop();
            Utils.srAnnounce(document.querySelector("#announcements"), announcements);
        }
    });
    //Zoom Buttons
    document.getElementById("zoomIn").addEventListener("click", () => {
        state.current_moving_distance = Math.max(1, state.current_moving_distance / 2);
        Utils.srAnnounce(document.querySelector("#announcements"), `Zoomed in to ${Utils.printDistance(state.current_moving_distance)}`);
    });
    document.getElementById("zoomOut").addEventListener("click", () => {
        state.current_moving_distance = Math.min(state.current_moving_distance * 2, 1609000);
        Utils.srAnnounce(document.querySelector("#announcements"), `Zoomed out to ${Utils.printDistance(state.current_moving_distance)}`);
    });
};
