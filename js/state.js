import { IntersectionGraph } from "./Map.js";
import { Intersection } from "./map-intersection.js";
import { Street } from "./map-street.js";

/**
 * Global application state shared across modules.
 *
 * This object stores the current navigation context for the
 * intersection explorer including user position, heading,
 * loaded map graph, and navigation history.
 *
 * @type {{
 *   intersection_graph: IntersectionGraph, 
 *   current_intersection: string,
 *   current_road: {
 *     intersection: string,
 *     street: string,
 *     angle: number,
 *     cardinal: string,
 *     distance: number
 *   } | null,
 *   next_intersection: string,
 *   current_tile: string,
 *   lat: number,
 *   lon: number,
 *   current_heading: number,
 *   current_moving_distance: number,
 *   current_rotation_increment: number,
 *   location_history: {
 *     lat: number,
 *     lon: number,
 *     intersection: string
 *   }[]
 * }}
 */
export const state = {
    intersection_graph: new IntersectionGraph(),
    current_intersection: "",
    current_road: null,
    next_intersection: "",
    current_tile: "",
    lat: 0,
    lon: 0,
    current_heading: 0,
    current_moving_distance: 90,
    current_rotation_increment: 45,
    location_history: []
};
