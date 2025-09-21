//File for all button events

//Importing utility functions since the button events rely on them
//Importing state since some buttons change the current state
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
            const road_data = Map.loadEnoughData(state.lat, state.lon);
            state.road_data = (await road_data).data;
            state.intersections = (await road_data).intersections;
            state.intersection_graph = Map.buildGraph(state.road_data, state.intersections);
            //1. Find and announce closest intersection
            const closest_intersection_id = Map.getClosestIntersectionNodeId(state.lat, state.lon, state.intersections, state.intersection_graph);
            const closest_intersection = Map.retrieveNode(state.road_data, closest_intersection_id);
            const edge = state.intersection_graph[closest_intersection_id];
            if (!edge) {
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
            announcements += `<p>Current intersection: ${Map.currentIntersectionTitle(edge.map(e => e.way))}</p>`;
            //2. Align on a road segment using the closest angle difference from the current bearing and announce.
            let bearing = state.current_heading;
            let best_segment = null;
            let smallest_diff = Infinity;
            for (const e of edge) {
                const next_intersection = Map.retrieveNode(state.road_data, e.to);
                const new_bearing = Math.round(Utils.getBearing(state.lat, state.lon, next_intersection.lat, next_intersection.lon));
                const diff = Math.abs(((new_bearing - bearing + 540) % 360) - 180);
                if (diff < smallest_diff) {
                    smallest_diff = diff;
                    best_segment = e;
                    bearing = new_bearing;
                }
            }
            state.current_heading = Utils.updateHeading(Math.round(bearing));
            announcements += `
            <p>Heading ${bearing} degrees ${state.directions[Math.round(bearing / 45) % 8]} on ${Map.getRoadName(best_segment.way)}</p>`;
            //Update current road
            state.current_road = {id: closest_intersection.id, bearing: bearing, road: best_segment};
            //3. Find next intersection based on the selected segment along with the distance and announce it.
            const next_intersection_data = Map.findNextRealIntersection(state.road_data, state.intersection_graph, best_segment, closest_intersection, bearing);
            if (!next_intersection_data) {
                announcements += `<p>Next intersection: Dead end.`;
                Utils.srAnnounce(document.getElementById("announcements"), announcements);
                return;
            }
            const next_intersection = next_intersection_data.intersection
            const next_edge = state.intersection_graph[next_intersection.id];
            const distance = Utils.calculateDistanceBetweenCordinates(closest_intersection.lat, closest_intersection.lon, next_intersection.lat, next_intersection.lon);
            announcements += `<p>Next intersection: ${Map.currentIntersectionTitle(next_edge.map(e => e.way))} ${Utils.printDistance(distance)} away.</p>`;
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
    document.querySelector("#turnLeft").addEventListener("click", () => {
        if (!state.is_road_mode) {
            state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
            Utils.srAnnounce(document.getElementById("announcements"), `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>`);
        }
        else {
            let announcements = "";
            //1. Select the edge based on the clock direction.
            const new_edge = Map.selectEdgeWhenTurning(state.road_data, state.intersection_graph, state.current_road.id, state.current_road.bearing, "counterclockwise");
            state.current_heading = Utils.updateHeading(Math.round(new_edge.bearing));
            state.current_road = {id: state.current_road.id, bearing: new_edge.bearing, road: new_edge.edge};
            //2. Announce turn and next intersection along with distance.
            announcements += `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(new_edge.bearing / 45) % 8]} on ${Map.getRoadName(new_edge.edge.way)}</p>`;
            const current_intersection = Map.retrieveNode(state.road_data, state.current_road.id);
            const next_intersection_data = Map.findNextRealIntersection(state.road_data, state.intersection_graph, new_edge.edge, current_intersection, new_edge.bearing);
            const next_edge = state.intersection_graph[next_intersection_data.intersection.id];
            const distance = Utils.calculateDistanceBetweenCordinates(current_intersection.lat, current_intersection.lon, next_intersection_data.intersection.lat, next_intersection_data.intersection.lon);
            announcements += `<p>Next intersection: ${Map.currentIntersectionTitle(next_edge.map(e => e.way))} ${Utils.printDistance(distance)} away.</p>`;
            Utils.srAnnounce(document.getElementById("announcements"), announcements);
        }
    });
    document.querySelector("#turnRight").addEventListener("click", () => {
        if (!state.is_road_mode) {
            state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
            Utils.srAnnounce(document.getElementById("announcements"), `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>`);
        }
        else {
            let announcements = "";
            //1. Select the edge based on the clock direction.
            const new_edge = Map.selectEdgeWhenTurning(state.road_data, state.intersection_graph, state.current_road.id, state.current_road.bearing, "clockwise");
            state.current_heading = Utils.updateHeading(Math.round(new_edge.bearing));
            state.current_road = {id: state.current_road.id, bearing: new_edge.bearing, road: new_edge.edge};
            //2. Announce turn and next intersection along with distance.
            announcements += `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(new_edge.bearing / 45) % 8]} on ${Map.getRoadName(new_edge.edge.way)}</p>`;
            const current_intersection = Map.retrieveNode(state.road_data, state.current_road.id);
            const next_intersection_data = Map.findNextRealIntersection(state.road_data, state.intersection_graph, new_edge.edge, current_intersection, new_edge.bearing);
            const next_edge = state.intersection_graph[next_intersection_data.intersection.id];
            const distance = Utils.calculateDistanceBetweenCordinates(current_intersection.lat, current_intersection.lon, next_intersection_data.intersection.lat, next_intersection_data.intersection.lon);
            announcements += `<p>Next intersection: ${Map.currentIntersectionTitle(next_edge.map(e => e.way))} ${Utils.printDistance(distance)} away.</p>`;
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
            const current_intersection = Map.retrieveNode(state.road_data, state.current_road.id);
            const next_intersection_data = Map.findNextRealIntersection(state.road_data, state.intersection_graph, state.current_road.road, current_intersection, state.current_road.bearing);
            if (!next_intersection_data) {
                Utils.srAnnounce(document.getElementById("announcements"), `<p>Cannot continue. It is either a dead end or not enough map data is available. Switch between explorer mode and road mode and try again.</p>`);
                return;
            }
            const next_intersection = next_intersection_data.intersection;
            state.lat = next_intersection.lat;
            state.lon = next_intersection.lon;
            //2. Announce new intersection along with distance moved.
            const distance = Utils.calculateDistanceBetweenCordinates(current_intersection.lat, current_intersection.lon, next_intersection.lat, next_intersection.lon);
            const next_edge = state.intersection_graph[next_intersection.id];
            state.current_heading = Utils.updateHeading(Math.round(next_intersection_data.bearing));
            announcements += `<p>Moved ${Utils.printDistance(distance)} ${state.directions[Math.round(state.current_road.bearing / 45) % 8]}</p>
            <p>Current intersection: ${Map.currentIntersectionTitle(next_edge.map(e => e.way))}.</p>
            <p>Heading ${state.current_heading} degrees ${state.directions[Math.round(state.current_heading / 45) % 8]} on ${Map.getRoadName(next_intersection_data.segment.way)}.</p>`;
            state.current_road = {id: next_intersection.id, bearing: next_intersection_data.bearing, road: next_intersection_data.segment};
            //3. Announce upcoming intersection and distance
            const upcoming_intersection_data = Map.findNextRealIntersection(state.road_data, state.intersection_graph, next_intersection_data.segment, next_intersection, next_intersection_data.bearing);
            if (!upcoming_intersection_data) {
                announcements += `<p>Next intersection: dead end.</p>`
                Utils.srAnnounce(document.getElementById("announcements"), announcements);
                return;
            }
            const upcoming_intersection = upcoming_intersection_data.intersection;
            const upcoming_edge = state.intersection_graph[upcoming_intersection.id];
            const upcoming_distance = Utils.calculateDistanceBetweenCordinates(next_intersection.lat, next_intersection.lon, upcoming_intersection.lat, upcoming_intersection.lon);
            announcements += `<p>Next intersection: ${Map.currentIntersectionTitle(upcoming_edge.map(e => e.way))} ${Utils.printDistance(upcoming_distance)} away.</p>`;
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
