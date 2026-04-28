import { IntersectionGraph } from "./Map.js";

//File to store the state of the global variables to be used across the code base

export const state = {
    intersection_graph: new IntersectionGraph(), //Holds the graph of intersections
    current_intersection: null, //Holds the current intersection ID in road mode
    current_road: null,//Holds the information on the currently aligned neighbor in road mode
    next_intersection: null, //The next intersection based on the current aligned street.
    lat: 0, //Current lat in decimal degrees
    lon: 0, //Current lon in decimal degrees
    current_heading: 0, //Current directional heading in degrees
    current_moving_distance: 90, //in meters
    current_rotation_increment: 45, //Increment for left and right turn buttons in degrees for free explore mode.
    directions: ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"],
    location_history: [], //Stores the coordinates of each point visited
    is_road_mode: false //Used to determine road mode verses free explore mode
};