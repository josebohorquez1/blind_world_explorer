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
            Utils.srAnnounce(document.getElementById("announcement"), `Changed mode to road mode. You will now be able to navigate by road.`);
            state.road_data = await Map.loadRoadData(state.lat, state.lon, 5);
            state.intersections = Map.buildIntersections(state.road_data);
            state.intersection_graph = Map.buildGraph(state.road_data, state.intersections);
            if (!state.intersections) {
                Utils.srAnnounce(document.getElementById("announcement"), `No roads available.`);
                state.is_road_mode = false;
                return;
            }
            const node_id = Map.getClosestIntersectionNodeId(state.lat, state.lon, state.intersections, state.intersection_graph);
            const node = Map.retrieveNode(state.road_data, node_id);
            state.lat = node.lat;
            state.lon = node.lon;
            const edges = state.intersection_graph[node_id];
            let best_edge = null;
            let best_diff = Infinity;
            let best_bearing = null;
            for (const edge of edges) {
                if (!edge.way.tags.name) continue;
                const next_node = Map.retrieveNode(state.road_data, edge.to);
                const bearing = (Math.round(Utils.getBearing(state.lat, state.lon, next_node.lat, next_node.lon) + 360)) % 360;
                const diff = ((bearing - state.current_heading) + 360) % 360;
                if (diff < best_diff) {
                    best_diff = diff;
                    best_edge = edge;
                    best_bearing = bearing;
                }
            }
            const new_intersection = Map.findNextRealIntersection(state.road_data, state.intersection_graph, best_edge, node, best_bearing);
            const intersection_string = "Current Intersection: " + Map.currentIntersectionTitle(state.intersection_graph[new_intersection.intersection.id].map(edge => edge.way));
            Utils.srAnnounce(document.getElementById("status"), `${intersection_string}.`);
            state.current_heading = Utils.updateHeading(Math.round(new_intersection.bearing));
            state.current_road = {id: new_intersection.intersection.id, bearing: new_intersection.bearing, road: new_intersection.segment};
            const next_intersection = state.intersection_graph[new_intersection.segment.to].map(edge => edge.way);
            const next_intersection_node = Map.retrieveNode(state.road_data, new_intersection.segment.to);
            const distance = Utils.calculateDistanceBetweenCordinates(new_intersection.intersection.lat, new_intersection.intersection.lon, next_intersection_node.lat, next_intersection_node.lon);
            Utils.srAnnounce(document.getElementById("announcement"), `Heading ${state.directions[Math.round(state.current_heading / 45) % 8]} on ${Map.getRoadName(new_intersection.segment.way)}.<br>Next Intersection: ${Map.currentIntersectionTitle(next_intersection)} ${Utils.printDistance(distance)} away.`);
        }
        else {
            e.target.textContent = "Change to Road Mode";
            Utils.updateStatus(state.lat, state.lon);
                        document.querySelectorAll("#openMovementSettingsButton, #zoomButtons button").forEach(el => {
                el.disabled = false;
                const colon_position = el.textContent.indexOf(":");
                el.textContent = el.textContent.substring(0, colon_position);
            });
        }
    });

    //Turn buttons
    document.querySelector("#turnLeft").addEventListener("click", () => {
        if (!state.is_road_mode) state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
        else {
            const new_edge = Map.selectEdgeWhenTurning(state.road_data, state.intersection_graph, state.current_road.id, state.current_road.bearing, "counterclockwise");
            state.current_heading = Utils.updateHeading(Math.round(new_edge.bearing));
            state.current_road = {id: state.current_road.id, bearing: new_edge.bearing, road: new_edge.edge};
            Utils.srAnnounce(document.getElementById("announcement"), `${state.directions[Math.round(new_edge.bearing / 45) % 8]} on ${Map.getRoadName(new_edge.edge.way)}`)
        }
    });
    document.querySelector("#turnRight").addEventListener("click", () => {
        if (!state.is_road_mode) state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
        else {
            const new_edge = Map.selectEdgeWhenTurning(state.road_data, state.intersection_graph, state.current_road.id, state.current_road.bearing, "clockwise");
            state.current_heading = Utils.updateHeading(Math.round(new_edge.bearing));
            state.current_road = {id: state.current_road.id, bearing: new_edge.bearing, road: new_edge.edge};
            Utils.srAnnounce(document.getElementById("announcement"), `${state.directions[Math.round(new_edge.bearing / 45) % 8]} on ${Map.getRoadName(new_edge.edge.way)}`)
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
            state.location_history.push({lat: state.lat, lon: state.lon});
            const current_intersection = Map.retrieveNode(state.road_data, state.current_road.id);
            const real_intersection = Map.findNextRealIntersection(state.road_data, state.intersection_graph, state.current_road.road, current_intersection, state.current_road.bearing);
            const next_intersection = real_intersection.intersection;
            state.lat = next_intersection.lat;
            state.lon = next_intersection.lon;
            const next_intersection_ways = state.intersection_graph[next_intersection.id].map(edge => edge.way);
            const upcoming_real_intersection = Map.findNextRealIntersection(state.road_data, state.intersection_graph, real_intersection.segment, next_intersection, real_intersection.bearing);
            const upcoming_intersection_string = Map.currentIntersectionTitle(state.intersection_graph[upcoming_real_intersection.intersection.id].map(edge => edge.way));
            const distance = Utils.calculateDistanceBetweenCordinates(current_intersection.lat, current_intersection.lon, next_intersection.lat, next_intersection.lon);
            Utils.srAnnounce(document.getElementById("announcement"), `Moved ${Utils.printDistance(distance)} ${state.directions[Math.round(state.current_road.bearing / 45) % 8]}`);
            let new_bearing = state.current_road.bearing;
            let heading_string = "";
            if (upcoming_intersection_string != "Dead end") {
                const upcoming_intersection = upcoming_real_intersection.intersection;
                new_bearing = Utils.getBearing(next_intersection.lat, next_intersection.lon, upcoming_intersection.lat, upcoming_intersection.lon);
                state.current_heading = Utils.updateHeading(Math.round(new_bearing));
                heading_string = `Heading ${state.directions[Math.round(new_bearing /45) % 8]} on ${Map.getRoadName(real_intersection.segment.way)}`;
            }
            Utils.srAnnounce(document.getElementById("status"), `Current Intersection: ${Map.currentIntersectionTitle(next_intersection_ways)}.<br>Next Intersection: ${upcoming_intersection_string}.<br>${heading_string? heading_string : ""}`);
            state.current_road = {id: real_intersection.intersection.id, bearing: new_bearing, road: real_intersection.segment};
            console.log(next_intersection.id);
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
