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
    for (const el of data) {
        if (el.type != "way") continue;
        const way = el;
        let segment_start = null;
        let distance_traveled = 0;
        for (let i = 0; i < way.nodes.length - 1; i++) {
            const node_id = way.nodes[i];
            const next_node_id = way.nodes[i + 1];
            if (!next_node_id) break;
            const dist = Utils.calculateDistanceBetweenCordinates(nodes[node_id].lat, nodes[node_id].lon, nodes[next_node_id].lat, nodes[next_node_id].lon);
            distance_traveled += dist;
            if (intersections[node_id] && segment_start == null) {
                segment_start = node_id;
                distance_traveled = 0;
            }
            if (intersections[next_node_id] && segment_start != null) {
                if (!graph[segment_start]) graph[segment_start] = [];
                if (!graph[next_node_id]) graph[next_node_id] = [];
                graph[segment_start].push({to: next_node_id, way: way, distance: distance_traveled});
                graph[next_node_id].push({to: segment_start, way: way, distance: distance_traveled});
                segment_start = next_node_id;
                distance_traveled = 0;
            }
        }
    }
    return graph;
}

//Function to retrieve a way
export const retrieveWay = (elements, way_id) => elements.find(el => el.type == "way" && el.id == way_id);

//Function to retrieve node by id.
export const retrieveNode = (elements, node_id) => elements.find(el => el.type == "node" && el.id == node_id);

//Function that retrieves the closest node to current location by sorting nodes of intersections by distance and returning the node id
export const getClosestIntersectionNodeId = (lat, lon, intersections) => {
    const sorted_list = Object.entries(intersections).filter(([node_id, data]) => data.ways.some(way => !["service", "footway", "residential", "cycleway"].includes(way.tags.highway))).map(([node_id, data]) => ({id: node_id, distance: Utils.calculateDistanceBetweenCordinates(lat, lon, data.lat, data.lon)})).sort((a, b) => a.distance - b.distance);
    return sorted_list[0].id;
}

//Function to retrieve the name of a road
export const getRoadName= (way) => {
    if (way.tags.name) return way.tags.name;
    else if (!way.tags.name && way.tags.highway == "service") return "Service Road";
    else if (!way.tags.name && way.tags.highway == "footway") return "Walking Path";
    else if (!way.tags.name && way.tags.highway == "service") return "Service Road";
    else if (!way.tags.name && way.tags.highway == "cycleway") return "Bike Path";
    else if (!way.tags.name && way.tags.highway == "residential") return "Residential Street";
    else return "Road";
}

//Function to retrieve the current intersection text
export const currentIntersectionTitle = (intersection) => {
    const names = [];
    for (const w of intersection) {
        if (w.tags.name) {
            if (!names.includes(w.tags.name)) names.push(getRoadName(w));
        }
        else names.push(getRoadName(w));
    }
    let intersection_string = "";
    if (intersection.length == 1) intersection_string += `${getRoadName(intersection[0])}`;
    else if (intersection.length == 2) intersection_string += `${getRoadName(intersection[0])} and ${getRoadName(intersection[1])}`;
    else {
        const last = names.pop();
        intersection_string += `${names.join(", ")} and ${last}`
    }
    return intersection_string;
};

//Function to continue on same road
export const continueOnSameRoad = (graph, current_intersection_id, edge) => {
    const next_intersection = edge.to;
    const next_intersection_edges = graph[next_intersection];
    if (!next_intersection_edges) return null;
    const continueing_edge = next_intersection_edges.filter(e => e.way.id == edge.way.id && e.to != current_intersection_id);
    return continueing_edge.length > 0? continueing_edge[0] : null;
};
