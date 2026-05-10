import { IntersectionGraph } from "./Map.js";

//File to store the state of the global variables to be used across the code base

export const state = {
    intersection_graph: new IntersectionGraph(),
    current_intersection: null,
    current_road: null,
    next_intersection: null,
    current_tile: null,
    lat: 0,
    lon: 0,
    current_heading: 0,
    current_moving_distance: 90,
    current_rotation_increment: 45,
    location_history: [],
};