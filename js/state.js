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
 *
 *   // The intersection the user is currently located at (if snapped to one)
 *   current_intersection: Intersection | null,
 *
 *   // Information about the road the user is currently traveling along
 *   current_road: {
 *     intersection: Intersection,
 *     street: Street,
 *     angle: number,
 *     cardinal: string,
 *     distance: number
 *   } | null,
 *
 *   // The next intersection along the currently followed road
 *   next_intersection: Intersection | null,
 *
 *   // Key of the tile the user is currently inside (e.g. "1234_5678")
 *   current_tile: string | null,
 *
 *   // Current geographic position
 *   lat: number,
 *   lon: number,
 *
 *   // User heading in degrees (0–360, where 0 = north)
 *   current_heading: number,
 *
 *   // Distance in meters to move when issuing a forward movement command
 *   current_moving_distance: number,
 *
 *   // Degrees to rotate when issuing a turn command
 *   current_rotation_increment: number,
 *
 *   // History of visited positions for "previous location" navigation
 *   location_history: {
 *     lat: number,
 *     lon: number,
 *     intersection: Intersection | null
 *   }[]
 * }}
 */
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
    location_history: []
};