//File containing the functions to retrieve map data for the application

//Importing utility functions, and app state
import { state } from "./state.js";
import * as Utils from "./UtilFunctions.js";

//Function that loads the road data and returns it
export const loadRoadData = async (lat, lon, radius_km) => {
    const box = Utils.getBoundingBox(lat, lon, radius_km);
    const query = `
        [out:json][timeout:60];
        way["highway"](${box.south},${box.west},${box.north},${box.east});
        out body;
        node(w);
        out body;`;
        const url = "https://overpass-api.de/api/interpreter";
        try {
            const res = await fetch(url, {
                method: "POST",
                body: query
            });
            if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);
            const data = await res.json();
            return data.elements;
        } catch (err) {
            console.error("Failed to load Overpass data:", err);
            return null;
        }
};

//Builds intersections by finding nodes that are linked to two or more ways
export const buildIntersections = (elements) => {
    const nodes = {};
    const ways = [];
    const intersections = {};
    for (const el of elements) {
        if (el.type == "node") nodes[el.id] = {lat: el.lat, lon: el.lon, ways: []};
        else if (el.type == "way") ways.push(el);
    }
    for (const way of ways) {
        if (way.tags.highway) {
            for (const node_id of way.nodes) {
                if (nodes[node_id]) nodes[node_id].ways.push(way);
            }
        }
    }
    for (const [node_id, data] of Object.entries(nodes)) {
        if (data.ways.length >= 2) intersections[node_id] = data;
    }
    return intersections;
};

//Function to make intersection graph
export const buildGraph = (data, intersections) => {
    const graph = {};
    const nodes = {};
    for (const el of data) {
        if (el.type == "node") nodes[el.id] = el;
    }
    for (const element of data) {
        //1. If element is not a way, or if the way is not a highway, skip it.
        if (element.type != "way" || !element.tags.highway) continue;
        //2. Walk along each nodes minus the last one
        const way = element;
        let segment_start = null;
        let distance_traveled = 0;
        for (let i = 0; i < way.nodes.length - 1; ++i) {
            //a. Get the first current node ID and next node ID along the way.
            const current_node_id = way.nodes[i];
            const next_node_id = way.nodes[i + 1];
            //B. If the next node does not exist, stop. We reached the end of the segment
            if (!next_node_id) break;
            //C. If the current node is a intersection, and if we haven't started a segment, start a segment and set distance to 0.
            if (intersections[current_node_id] && segment_start == null) {
                segment_start = current_node_id;
                distance_traveled = 0;
            }
            //D. Get the current node and next node and calculate the distance between the current node and next node if the nodes exist.
            const current_node = nodes[current_node_id];
            const nex_node = nodes[next_node_id];
            if (current_node && nex_node) {
                distance_traveled += Utils.calculateDistanceBetweenCordinates(current_node.lat, current_node.lon, nex_node.lat, nex_node.lon)
            }
            //E. if the next node ID is an intersection and we have started a segment, end the segment by forming the connection, start a new segment, and reset distance traveled.
            if (intersections[next_node_id] && segment_start != null) {
                //I. If the edge for the current node does not exist, create it with an empty list.
                if (!graph[segment_start]) graph[segment_start] = [];
                //II. If the edge for the next node does not exist, create it as well.
                if (!graph[next_node_id]) graph[next_node_id] = [];
                //III. Push the new connection between first and second node and second node and first node.
                graph[segment_start].push({to: next_node_id, way: way, distance: distance_traveled});
                graph[next_node_id].push({to: segment_start, way: way, distance: distance_traveled});
                //IV. Reset for the next walk by reseting distance and starting segment at the next intersection node ID.
                distance_traveled = 0;
                segment_start = next_node_id;
            }
    }
}
    return graph;
}
//Function to ensure that there is enough data to work with.
export const loadEnoughData = async (lat, lon) => {
    let radius_km = 5;
    let intersection_count = 0;
    let road_data, intersections;
    while (intersection_count < 5000 && radius_km <= 50) {
        road_data = await loadRoadData(lat, lon, radius_km);
        intersections = buildIntersections(road_data);
        intersection_count = Object.keys(intersections).length;
        if (intersection_count >= 5000) break;
        radius_km *= 2;
    }
    return {intersections: intersections, data: road_data};
};

//Function to retrieve a way
export const retrieveWay = (elements, way_id) => elements.find(el => el.type == "way" && el.id == way_id);

//Function to retrieve node by id.
export const retrieveNode = (elements, node_id) => elements.find(el => el.type == "node" && el.id == node_id);

//Function that retrieves the closest node to current location by sorting nodes of intersections by distance and returning the node id
export const getClosestIntersectionNodeId = (lat, lon, intersections, graph) => {
    const sorted_list = Object.entries(intersections).filter(([node_id, data]) => !shouldCollapseIntersection(graph, node_id)).map(([node_id, data]) => ({id: node_id, distance: Utils.calculateDistanceBetweenCordinates(lat, lon, data.lat, data.lon)})).sort((a, b) => a.distance - b.distance);
    return sorted_list[0].id;
}

//Function to retrieve the name of a road
export const getRoadName= (way) => {
    if (way.tags.name && way.tags.ref) return `${way.tags.name} / ${way.tags.ref}`;
    if (way.tags.name) return way.tags.name;
    else if (!way.tags.name && way.tags.highway == "service") return "Service Road";
    else if (!way.tags.name && way.tags.highway == "footway") return "Walking Path";
    else if (!way.tags.name && way.tags.highway == "service") return "Service Road";
    else if (!way.tags.name && way.tags.highway == "cycleway") return "Bike Path";
    else if (!way.tags.name && way.tags.highway == "residential") return "Residential Street";
    else if (!way.tags.name && way.tags.ref) return way.tags.ref;
    else if (!way.tags.name && way.tags.junction == "roundabout") return "Roundabout";
    else if (!way.tags.name && way.tags.highway == "motorway_link") {
        let hwy_ramp = "Ramp";
        if (way.tags["junction:ref"]) hwy_ramp = `Offramp - exit ${way.tags["junction:ref"]}`;
        way.tags["destination:ref"] ? hwy_ramp += ` onto ${way.tags["destination:ref"]}` : "Ramp";
        way.tags.destination ? hwy_ramp += ` - towards ${way.tags.destination}` : "";
        return hwy_ramp;
    }
    else return "Road";
}

//Function to retrieve the current intersection text
export const currentIntersectionTitle = (intersection) => {
    const names = [];
    for (const w of intersection) {
        if (w.tags.name) {
            if (!names.includes(w.tags.name)) names.push(w.tags.name);
        }
        else names.push(getRoadName(w));
    }
    let intersection_string = "";
    if (names.length == 1) intersection_string += `${names[0]}`;
    else if (names.length == 2) intersection_string += `${names[0]} and ${names[1]}`;
    else {
        const last = names.pop();
        intersection_string += `${names.join(", ")} and ${last}`
    }
    return intersection_string;
};

//Function to continue on same road
export const continueOnSameRoad = (graph, current_intersection_id, edge, incoming_bearing) => {
    const next_intersection = edge.to;
    const next_intersection_edges = graph[next_intersection];
    if (!next_intersection_edges) return null;
    let best_edge = null;
    let best_diff = Infinity;
    for (const e of next_intersection_edges) {
        if (e.to == current_intersection_id) continue;
        const to_node = retrieveNode(state.road_data, e.to);
        const intersection_node = retrieveNode(state.road_data, next_intersection);
        const outgoing_bearing = Utils.getBearing(intersection_node.lat, intersection_node.lon, to_node.lat, to_node.lon);
        const diff = Math.abs(((incoming_bearing - outgoing_bearing + 540) % 360) - 180);
        if (diff < best_diff) {
            best_diff = diff;
            best_edge = e;
        }
    }
    return best_edge;
};

//Function to help determine if an intersection should be collapsed or not to avoid service roads and non roads
export const shouldCollapseIntersection = (graph, node_id) => {
    const is_low_priority = (way) => ["service", "footway", "cycleway", "path", "track", "primary_link", "secondary_link"].includes(way.tags.highway);
    const edges = graph[node_id];
    if (!edges) return true;
    const real_roads = edges.filter(e => !is_low_priority(e.way)).map(e => getRoadName(e.way));
    if (real_roads.length == 0) return true;
    if (real_roads.length == 2 && real_roads[0] == real_roads[1]) return true;
    const distinct_roads = [...new Set(real_roads)];
    return distinct_roads.length == 1;
}

//Function to skip service roads, walking paths, and other trivial roads
export const findNextRealIntersection = (data, graph, segment, intersection, bearing) => {
    //1. Get next intersection based on the current segment, and if intersection has no next intersection or if dead end is true, then stop searching and return.
    let current_intersection_id = intersection.id;
    let current_intersection = intersection;
    let current_bearing = bearing;
    let current_segment= segment;
    let distance = segment.distance;
    let next_intersection_id = segment.to;
    if (!graph[next_intersection_id]) return {segment: current_segment, intersection: current_intersection, bearing: current_bearing, distance: distance};
    let next_intersection = retrieveNode(data, next_intersection_id);
    let next_segment_data = getBestSegmentByAngularDifference(data, graph[next_intersection_id], next_intersection_id, current_bearing);
    let next_segment = next_segment_data.segment;
    let next_bearing = next_segment_data.bearing;
    //2. if the next intersection should collapse, move to the next intersection, find the next best segment, retrieve the next upcoming intersection, and add distance based on the bearing between the current intersection and next intersection
    while (shouldCollapseIntersection(graph, next_intersection_id)) {
    current_intersection_id = next_intersection_id;
    current_intersection = next_intersection;
    current_bearing = next_bearing;
    current_segment= next_segment;
    distance += current_segment.distance;
    next_intersection_id = current_segment.to;
    if (!graph[next_intersection_id] || graph[next_intersection_id].dead_end) return {segment: current_segment, intersection: retrieveNode(data, next_intersection_id), bearing: current_bearing, distance: distance};
    next_intersection = retrieveNode(data, next_intersection_id);
    next_segment_data = getBestSegmentByAngularDifference(data, graph[next_intersection_id], next_intersection_id, current_bearing);
    next_segment = next_segment_data.segment;
    next_bearing = next_segment_data.bearing;
    }
            return {segment: next_segment, intersection: next_intersection, bearing: next_bearing, distance: distance};
};

//Function to determine the best edge based on a clock for turning
export const selectEdgeWhenTurning = (data, graph, intersection_id, incoming_bearing, clock_direction) => {
    const intersection = retrieveNode(data, intersection_id);
    const edge = graph[intersection_id];
    const edge_bearings = edge.map(e => {
        const next_intersection = retrieveNode(data, e.to);
        const e_bearing = Utils.getBearing(intersection.lat, intersection.lon, next_intersection.lat, next_intersection.lon);
        return {edge: e, bearing: e_bearing};
    }).filter(e => !["service", "footway", "cycleway", "path", "track"].includes(e.edge.way.tags.highway));
    edge_bearings.sort((a, b) => a.bearing - b.bearing);
    let smallest_diff = Infinity;
    let current_index = null;
    for (let i = 0; i < edge_bearings.length; i++) {
        const diff = Math.abs(((edge_bearings[i].bearing - incoming_bearing + 540) % 360) - 180);
        if (diff < smallest_diff) {
            smallest_diff = diff;
            current_index = i;
        }
    }
    let new_edge;
    if (clock_direction == "clockwise") new_edge = edge_bearings[(current_index + 1) % edge_bearings.length];
    if (clock_direction == "counterclockwise") new_edge = edge_bearings.at(current_index - 1);
    return {edge: new_edge.edge, bearing: new_edge.bearing};
};

export const getBestSegmentByAngularDifference = (data, edge, current_intersection_id, current_bearing) => {
    let best_bearing = current_bearing;
    let best_segment = null;
    let smallest_diff = Infinity;
    for (const e of edge) {
        const current_intersection = retrieveNode(data, current_intersection_id);
        const next_intersection = retrieveNode(data, e.to);
        const new_bearing = Math.round(Utils.getBearing(current_intersection.lat, current_intersection.lon, next_intersection.lat, next_intersection.lon));
        const diff = Math.abs(((new_bearing - current_bearing + 540) % 360) - 180);
        if (diff < smallest_diff) {
            smallest_diff = diff;
            best_segment = e;
            best_bearing = new_bearing;
        }
    }
    return {segment: best_segment, bearing: best_bearing};
}
