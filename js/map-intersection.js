/**
 * Represents an OSM node where two or more streets meet.
 *
 * Fields:
 *   id      {string}    OSM node ID
 *   lat     {number}    Latitude
 *   lon     {number}    Longitude
 *   streets {Street[]}  All streets that pass through this node
 *   edges   {Map<string, Edge>}    All directed edges departing from this node
 */

import { Edge } from "./map-edge.js";

export class Intersection {
  /**
   * @param {string} id   OSM node ID
   * @param {number} lat
   * @param {number} lon
   */
  constructor(id, lat, lon) {
    this.id = id;
    this.lat = lat;
    this.lon = lon;
    
    /** @type {Map<string, Edge>} */
    this.edges = new Map();
  }

  /**
   * Appends a directed edge departing from this intersection.
   *
   * @param {string} edgeId
   * @param {Edge} edge
   */
  addEdge(edgeId, edge) {
    this.edges.set(edgeId, edge);
  }

  /**
   * Gets an edge based on an edge ID
   * Returns the edge if found, otherwise null
   * @param {string} edgeId 
   * @returns {Edge | null}
   */
  getEdge(edgeId) {
    return this.edges.get(edgeId) ?? null;
  }

  /**
   * Deduplicated list of display labels for all streets at this intersection.
   *
   * @returns {string[]}
   */
  get streetNames() {
    const seen = new Set();
    return [...this.edges.values()]
      .map((e) => e.segment.label)
      .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }

  /**
   * Screen-reader-friendly description of this intersection.
   *
   * Examples:
   *   "Main Street and University Avenue"
   *   "Main Street, University Avenue, and 13th Street"
   *
   * @returns {string}
   */
  get description() {
    const names = this.streetNames;
    if (names.length === 0) return "Unknown Intersection";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    const last = names[names.length - 1];
    const rest = names.slice(0, -1).join(", ");
    return `${rest}, and ${last}`;
  }
}
