//File for all button events

//Importing utility functions since the button events rely on them
//Importing state since some buttons change the current state
import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";
import * as Map from "./Map.js";

//Function wrapper for all button event to easily export them
export const initButtons = () => {
    //Change mode button
    document.getElementById("changeModeButton").addEventListener("click", (e) => {
        state.is_road_mode = !state.is_road_mode;
        if (state.is_road_mode) {
            if (!state.intersections) {
                Utils.srAnnounce(document.getElementById("announcement"), `No roads available.`);
                state.is_road_mode = false;
                return;
            }
            e.target.textContent = "Change to Explorer Mode";
            Utils.srAnnounce(document.getElementById("announcement"), `Changed mode to road mode. You will now be able to navigate by road.`);
            const node_id = Map.getClosestIntersectionNodeId(state.lat, state.lon, state.intersections);
            const node = Map.retrieveNode(state.road_data, node_id);
            state.lat = node.lat;
            state.lon = node.lon;
            const edges = state.intersection_graph[node_id];
            let best_edge = null;
            let best_diff = Infinity;
            let best_bearing = null;
            for (const edge of edges) {
                const next_node = Map.retrieveNode(state.road_data, edge.to);
                const bearing = (Math.round(Utils.getBearing(state.lat, state.lon, next_node.lat, next_node.lon) + 360)) % 360;
                const diff = ((bearing - state.current_heading) + 360) % 360;
                if (diff < best_diff) {
                    best_diff = diff;
                    best_edge = edge;
                    best_bearing = bearing;
                }
            }
            const intersection_string = "Current Intersection: " + Map.currentIntersectionTitle(edges.map(edge => edge.way));
            Utils.srAnnounce(document.getElementById("status"), `${intersection_string}.`);
            state.current_heading = Utils.updateHeading(Math.round(best_bearing));
            state.current_road = {id: node_id, bearing: best_bearing, road: best_edge};
            const continueing_edge = Map.continueOnSameRoad(state.intersection_graph, node_id, best_edge, best_bearing);
            const next_intersection = state.intersection_graph[best_edge.to].map(edge => edge.way);
            Utils.srAnnounce(document.getElementById("announcement"), `Heading ${state.directions[Math.round(state.current_heading / 45) % 8]} on ${Map.getRoadName(best_edge.way)}.<br>Next Intersection: ${Map.currentIntersectionTitle(next_intersection)} ${Utils.printDistance(continueing_edge.distance)} away.`);
        }
        else {
            e.target.textContent = "Change to Road Mode";
            Utils.updateStatus(state.lat, state.lon);
        }
    });

    //Turn buttons
    document.querySelector("#turnLeft").addEventListener("click", () => {
        if (!state.is_road_mode) state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
        else {
            const current_node_id = Map.getClosestIntersectionNodeId(state.lat, state.lon, state.intersections);
            const current_edge = state.intersection_graph[current_node_id];
            const disired_heading = (state.current_heading - 90 + 360) %360;
            let best_edge = null;
            let best_diff = Infinity;
            let best_bearing = null;
            for (const edge of current_edge) {
                const next_node = Map.retrieveNode(state.road_data, edge.to);
                const bearing = (Utils.getBearing(state.lat, state.lon, next_node.lat, next_node.lon) + 360) % 360;
                const diff = Math.abs(((bearing - disired_heading + 540) % 360) - 180);
                if (bearing == state.current_heading) continue;
                if (diff < best_diff) {
                    best_diff = diff;
                    best_edge = edge;
                    best_bearing = bearing;
                }
            }
            state.current_heading = Utils.updateHeading(Math.round(best_bearing));
            state.current_road = {id: current_node_id, bearing: best_bearing, road: best_edge};
            Utils.srAnnounce(document.getElementById("announcement"), `${state.directions[Math.round(best_bearing / 45) % 8]} on ${Map.getRoadName(best_edge.way)}`)
        }
    });
    document.querySelector("#turnRight").addEventListener("click", () => {
        if (!state.is_road_mode) state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
        else {
            const current_node_id = Map.getClosestIntersectionNodeId(state.lat, state.lon, state.intersections);
            const current_edge = state.intersection_graph[current_node_id];
            const disired_heading = (state.current_heading + 90) %360;
            let best_edge = null;
            let best_diff = Infinity;
            let best_bearing = null;
            for (const edge of current_edge) {
                const next_node = Map.retrieveNode(state.road_data, edge.to);
                const bearing = (Utils.getBearing(state.lat, state.lon, next_node.lat, next_node.lon) + 360) % 360;
                const diff = Math.abs(((bearing - disired_heading + 540) % 360) - 180);
                if (bearing == state.current_heading) continue;
                if (diff < best_diff) {
                    best_diff = diff;
                    best_edge = edge;
                    best_bearing = bearing;
                }
            }
            state.current_heading = Utils.updateHeading(Math.round(best_bearing));
            state.current_road = {id: current_node_id, bearing: best_bearing, road: best_edge};
            Utils.srAnnounce(document.getElementById("announcement"), `${state.directions[Math.round(best_bearing / 45) % 8]} on ${Map.getRoadName(best_edge.way)}`)
        }
    });
    document.getElementById("turnAround").addEventListener("click", () => state.current_heading = Utils.updateHeading(state.current_heading + 180));
    document.querySelector("#go").addEventListener("click", () => {
        if (!state.is_road_mode) {
            state.location_history.push({lat: state.lat, lon: state.lon});
        const {lat: new_lat, lon: new_lon} = Utils.move(state.lat, state.lon, state.current_moving_distance, state.current_heading);
        state.lat = new_lat;
        state.lon = new_lon;
            Utils.updateStatus(state.lat, state.lon);
        Utils.srAnnounce(document.querySelector("#announcement"), `Moved ${Utils.printDistance(state.current_moving_distance)} ${state.directions[Math.round(state.current_heading / 45) % 8]}.`);
        }
        else {
            const next_segment = Map.continueOnSameRoad(state.intersection_graph, state.current_road.id, state.current_road.road, state.current_road.bearing);
            if (!next_segment) {
                Utils.srAnnounce(document.getElementById("announcement"), `Dead end: cannot continue.`);
                return;
            }
            state.location_history.push({lat: state.lat, lon: state.lon});
            const next_intersection_id = state.current_road.road.to;
            const next_intersection = Map.retrieveNode(state.road_data, next_intersection_id);
            const moving_distance = next_segment.distance;
            state.lat = next_intersection.lat;
            state.lon = next_intersection.lon;
            const next_intersection_ways = state.intersection_graph[next_intersection_id].map(edge => edge.way);
            const upcoming_intersection_string = Map.continueOnSameRoad(state.intersection_graph, next_segment.to, next_segment, state.current_road.bearing) ? Map.currentIntersectionTitle(state.intersection_graph[next_segment.to].map(edge => edge.way)) : "Dead end";
            Utils.srAnnounce(document.getElementById("announcement"), `Moved ${Utils.printDistance(moving_distance)} ${state.directions[Math.round(state.current_road.bearing / 45) % 8]}`);
            let new_bearing = state.current_road.bearing;
            let heading_string = "";
            if (upcoming_intersection_string != "Dead end") {
                const upcoming_intersection = Map.retrieveNode(state.road_data, next_segment.to);
                new_bearing = Utils.getBearing(next_intersection.lat, next_intersection.lon, upcoming_intersection.lat, upcoming_intersection.lon);
                state.current_heading = Utils.updateHeading(Math.round(new_bearing));
                heading_string = `Heading ${state.directions[Math.round(new_bearing /45) % 8]} on ${Map.getRoadName(next_segment.way)}`;
            }
            Utils.srAnnounce(document.getElementById("status"), `Current Intersection: ${Map.currentIntersectionTitle(next_intersection_ways)}.<br>Next Intersection: ${upcoming_intersection_string}.<br>${heading_string? heading_string : ""}`);
            state.current_road = {id: next_intersection_id, bearing: new_bearing, road: next_segment};
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
