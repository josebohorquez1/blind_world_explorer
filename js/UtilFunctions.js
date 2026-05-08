/**
 * UtilFunctions.js
 *
 * Shared utility functions used across the intersection explorer codebase.
 *
 * Covers:
 *   - Geospatial math: distance, bearing, bounding box, forward projection
 *   - Navigation helpers: heading normalization, cardinal direction, angular difference
 *   - UI helpers: screen reader announcements, distance formatting, reverse geocoding
 */

import { state } from "./state.js";
import * as Map from "./Map.js";
import { switchApplicationView } from "./loader.js";
import { initExploreMode } from "./mode-explore.js";

/**
 * Announces a message to screen readers via an ARIA live region.
 *
 * Clears the element first, then sets new content after a short delay.
 * The delay ensures assistive technologies register the DOM change as a new event.
 *
 * @param {HTMLElement} element  The live region element (e.g. #announcements)
 * @param {string}      message  HTML string to inject
 */
export const srAnnounce = (element, message) => {
  element.innerHTML = "";
  setTimeout(() => {
    element.innerHTML = message;
  }, 50);
};

/**
 * Formats a meter distance as a human-readable imperial string.
 *
 * Uses feet for distances under ~0.1 miles (158.4 m), miles otherwise.
 *
 * @param {number} distance_in_meters
 * @returns {string}  e.g. "320 feet" or "1.2 miles"
 */
export const printDistance = (distance_in_meters) => {
  if (distance_in_meters < 158.4) return `${Math.floor(distance_in_meters / 0.3048)} feet`;
  return `${(distance_in_meters / 1609.34).toFixed(1)} miles`;
};

/**
 * Normalizes a heading in degrees to the range [0, 359].
 *
 * @param {number} heading  Any heading value (may be negative or over 360)
 * @returns {number}  Equivalent heading in [0, 359]
 */
export const updateHeading = (heading) => {
  return (heading + 360) % 360;
};

/**
 * Projects a new lat/lon from a starting point, given a distance and bearing.
 * Uses the spherical law of cosines (forward geodetic problem).
 *
 * @param {number} lat1            Starting latitude in degrees
 * @param {number} lon1            Starting longitude in degrees
 * @param {number} moving_distance Distance to move in meters
 * @param {number} heading         Direction of travel in degrees (0 = North, clockwise)
 * @returns {{ lat: number, lon: number }}  Destination coordinates in degrees
 */
export const move = (lat1, lon1, moving_distance, heading) => {
  const R = 6371000; // Earth's mean radius in meters
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  lat1 *= rad;
  lon1 *= rad;
  const heading_r = heading * rad;
  const angular_distance = moving_distance / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular_distance) +
    Math.cos(lat1) * Math.sin(angular_distance) * Math.cos(heading_r)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(heading_r) * Math.sin(angular_distance) * Math.cos(lat1),
    Math.cos(angular_distance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return { lat: lat2 * deg, lon: lon2 * deg };
};

/**
 * Computes the great-circle distance between two lat/lon points using the Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}  Distance in meters
 */
export const calculateDistanceBetweenCordinates = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's mean radius in meters
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Computes a bounding box around a center point given a radius in kilometers.
 *
 * @param {number} center_lat   Center latitude in degrees
 * @param {number} center_lon   Center longitude in degrees
 * @param {number} radius_km    Radius (expected in km, but see note above)
 * @returns {{ south: number, west: number, north: number, east: number }}
 *   Bounding box corners in degrees
 */
export const getBoundingBox = (center_lat, center_lon, radius_km) => {
  const lat_deg_per_km = 111.32;
  // Longitude degrees per km shrinks toward the poles
  const lon_deg_per_km = 111.32 * Math.cos(center_lat * Math.PI / 180);
  const delta_lat = radius_km / lat_deg_per_km;
  const delta_lon = radius_km / lon_deg_per_km;
  return {
    south: center_lat - delta_lat,
    west:  center_lon - delta_lon,
    north: center_lat + delta_lat,
    east:  center_lon + delta_lon,
  };
};

/**
 * Computes the initial bearing and cardinal direction from one lat/lon point to another.
 * Returns a value in [0, 360), where 0 is North, increasing clockwise along with one of the eight compass directions.
 *
 * @param {number} fromLat
 * @param {number} fromLon
 * @param {number} toLat
 * @param {number} toLon
 * @returns {{ cardinal: string, angle: number }}
 *   cardinal: one of the 8 compass labels from state.directions (e.g. "North", "Southwest")
 *   angle:    bearing in degrees [0, 360)
 */
export const getBearingAndDirection = (fromLat, fromLon, toLat, toLon) => {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;
  const φ1 = toRad(fromLat);
  const φ2 = toRad(toLat);
  const Δλ = toRad(toLon - fromLon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = toDeg(Math.atan2(y, x));
  const normalized = Math.round((θ + 360) % 360);
  return { cardinal: getCardinalDirection(normalized), angle: normalized };
};

/**
 * Computes the signed smallest angular difference from bearing `a` to bearing `b`.
 *
 * A positive result means `b` is clockwise from `a`; negative means counter-clockwise.
 * The +540 trick folds the subtraction into [0, 360) before re-centering on [-180, 180).
 *
 * @param {number} a  Current bearing in degrees (0–360)
 * @param {number} b  Target bearing in degrees (0–360)
 * @returns {number}  Signed difference in degrees within [-180, 180)
 */
export const angleDiff = (a, b) => {
  return ((b - a + 540) % 360) - 180;
};

/**
 * Determines a cardinal direction given a heading in degrees between 0 and 359.
 * The function will return north, northeast, east, southeast, south, southwest, west, and northwest
 * If heading is less than 0 or greater than 359, the function will return an empty string
 * @param {number} heading - The heading in degrees
 * @returns {string}
 */
export const getCardinalDirection = (heading) => {
  if (heading < 0 || heading >= 360) return "";
  const directions = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];
  return directions[
    Math.round(heading / 45) %8
  ];
}

/**
 * Waits x miliseconds before continuing execution
 * @param {number} ms - The number in miliseconds to wait
 * @returns {void}
 */
export const sleep = (ms) => {
  if (ms < 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
};
