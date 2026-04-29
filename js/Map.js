/**
 * map.js
 *
 * Builds a navigable street graph from OpenStreetMap data via the Overpass API.
 * Designed for a nonvisual intersection explorer (screen reader friendly).
 *
 * Classes:
 *   Street          -- a named road segment between two intersections
 *   Intersection    -- an OSM node where two or more named streets meet
 *   IntersectionGraph -- the full graph; handles fetching, parsing, and traversal
 */

//Modules
import * as Utils from "./UtilFunctions.js";

//Constants
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const EXCLUDED_HIGHWAY_TYPES = new Set([
  "footway",
  "path",
  "cycleway",
  "bridleway",
  "steps",
  "corridor",
  "sidewalk",
  "track",
]);

/**
 * Represents a named road segment (OSM Way) connecting two intersections.
 *
 * Properties:
 *   id          {string}   OSM way ID
 *   name        {string}   Road name (e.g. "University Avenue")
 *   ref         {string}   Road reference number if any (e.g. "US-441")
 *   highwayType {string}   OSM highway tag value (e.g. "residential")
 *   nodeIds     {string[]} Ordered list of OSM node IDs along this way
 */
class Street {
      /**
   * @param {object} osmWay  Raw OSM way element from Overpass JSON
   */
  constructor(osmWay) {
    this.id = String(osmWay.id);
    this.name = osmWay.tags?.name || null;
    this.ref = osmWay.tags?.ref || null;
    this.highwayType = osmWay.tags?.highway || "road";
    this.nodeIds = (osmWay.nodes || []).map(String);
  }

    /**
   * Returns the display label for this street, ref - name will be used if ref is available.
   * @returns {string}
   */
  get label() {
    if (this.name && this.ref) return `${this.ref} / ${this.name}`;
    if (this.name) return this.name;
    if (this.ref) return this.ref;
    return "Service Road";
  }

    /**
   * Given one endpoint node ID, returns the other endpoint node ID
   * along this street's node sequence.
   *
   * This is used to traverse: starting from intersection A on this street,
   * what is the next intersection in that direction?
   *
   * @param {string} fromNodeId  Starting node ID
   * @returns {string|null}       The other end node ID, or null if not found
   */
  otherEndFrom(fromNodeId) {
    if (this.nodeIds[0] === fromNodeId) return this.nodeIds[this.nodeIds.length - 1];
    if (this.nodeIds[this.nodeIds.length - 1] === fromNodeId) return this.nodeIds[0];
    return null;
  }

  /**
   * Returns whether a given node ID is one of the endpoints of this street
   * (i.e., first or last node in the sequence).
   * @param {string} nodeId
   * @returns {boolean}
   */
    isEndpoint(nodeId) {
        return (
            this.nodeIds[0] === nodeId
            || this.nodeIds[this.nodeIds.length - 1] === nodeId
        );
    }

    /**
     * Checks if the street is named.
     * @returns {boolean}
     */
    get isUnnamed() {
        return !this.name && !this.ref;
    }
}

/**
 * Represents an intersection: an OSM node where two or more named streets meet.
 *
 * Properties:
 *   id          {string}    OSM node ID
 *   lat         {number}    Latitude
 *   lon         {number}    Longitude
 *   streets     {Street[]}  All streets that pass through this intersection
 */
class Intersection {
  /**
   * @param {string} id   OSM node ID
   * @param {number} lat
   * @param {number} lon
   */
  constructor(id, lat, lon) {
    this.id = id;
    this.lat = lat;
    this.lon = lon;
    /** @type {Street[]} */
    this.streets = [];
  }
  /**
   * Adds a street to this intersection (avoids duplicates).
   * @param {Street} street
   */
  addStreet(street) {
    if (!this.streets.find((s) => s.id === street.id)) {
        this.streets.push(street);
    }
  }

    /**
   * Returns unique street names at this intersection.
   * @returns {string[]}
   */
  get streetNames() {
    const seen = new Set();
    return this.streets
    .map((s) => s.label)
    .filter((name) => {
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
    });
  }

  /**
   * Returns a human-readable description of this intersection,
   * suitable for screen reader announcement.
   *
   * Examples:
   *   "Intersection of Main Street and University Avenue"
   *   "Intersection of Main Street, University Avenue, and 13th Street"
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

/**
 * A graph of intersections connected by streets.
 *
 * Nodes: Intersection instances, keyed by OSM node ID.
 * Edges: Implicit -- derived from Street.nodeIds shared between intersections.
 *
 * Main responsibilities:
 *   - Fetch OSM data via Overpass API
 *   - Parse OSM ways and nodes into Street and Intersection objects
 *   - Provide graph traversal: neighbors, nearest intersection, path along a street
 */
export class IntersectionGraph {
  constructor() {
    /** @type {Map<string, Intersection>} */
    this.intersections = new Map();

    /** @type {Map<string, Street>} */
    this.streets = new Map();

    /**
     * Maps every OSM node ID to the IDs of ways that pass through it.
     * Used during construction to identify intersection nodes.
     * @type {Map<string, Set<string>>}
     */
    this._nodeToWayIds = new Map();

    /**
     * Raw node coordinate store for all OSM nodes (not just intersections).
     * Needed to calculate distances along streets.
     * @type {Map<string, {lat: number, lon: number}>}
     */
    this._nodeCoords = new Map();
    this.unnamedRoadsDisabled = true;
  }

    /**
   * Builds an Overpass QL query to fetch all walkable highway ways
   * and their nodes within a radius of a center point.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} radius  Radius in meters
   * @returns {string}  Overpass QL query string
   */
_buildQuery(lat, lon, radius) {
  const box = Utils.getBoundingBox(lat, lon, radius);
  return `
[out:json][timeout:60];
way["highway"]["highway"!~"footway|path|cycleway|bridleway|steps|corridor|sidewalk|track"]
(${box.south},${box.west},${box.north},${box.east});
out body;
node(w);
out body;
  `.trim();
}
    
  /**
   * Fetches OSM data from the Overpass API.
   *
   * @param {string} query  Overpass QL query
   * @returns {Promise<object>}  Parsed JSON response
   * @throws {Error} on network or API failure
   */
  async _fetchOverpass(query) {
    const response = await fetch(OVERPASS_ENDPOINT, {
              method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) {
      throw new Error(
        `Overpass API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Parses an Overpass JSON response into the graph's internal data structures.
   *
   * Step 1: Index all nodes (coordinates).
   * Step 2: Build Street objects from OSM ways (filtering unnamed/unwalkable).
   * Step 3: Build the nodeToWayIds index.
   * Step 4: Identify intersection nodes.
   * Step 5: Create Intersection objects and attach their streets.
   *
   * @param {object} osmData  Parsed Overpass JSON
   */
  _parseOsmData(osmData)   {
    this.intersections.clear();
    this.streets.clear();
    this._nodeToWayIds.clear();
    this._nodeCoords.clear();
    const elements = osmData.elements || [];
    if (elements.length === 0) return;
    for (const el of elements) {
        if (el.type === "node") this._nodeCoords.set(String(el.id), {lat: el.lat, lon: el.lon});
    }
    for (const el of elements) {
        if (el.type != "way") continue;
        if (!el.tags?.highway) continue;
        if (EXCLUDED_HIGHWAY_TYPES.has(el.tags.highway)) continue;
        const street = new Street(el)
        this.streets.set(street.id, street);
    }
    for (const street of this.streets.values()) {
        for (const nodeId of street.nodeIds) {
            if (!this._nodeToWayIds.has(nodeId)) this._nodeToWayIds.set(nodeId, new Set());
            this._nodeToWayIds.get(nodeId).add(street.id);
        }
    }
    const intersectionNodes = new Set();
    for (const [nodeId, wayIds] of this._nodeToWayIds.entries()) {
        if (wayIds.size < 2) continue;
        intersectionNodes.add(nodeId);
    }
    for (const street of this.streets.values()) {
        if (street.nodeIds.length === 0) continue;
        const endpoints = [
            street.nodeIds[0],
            street.nodeIds[street.nodeIds.length - 1]
        ];
        for (const endpoint of endpoints) intersectionNodes.add(endpoint);
    }
    for (const nodeId of intersectionNodes) {
        const coords = this._nodeCoords.get(nodeId);
        if (!coords) continue;
        const intersection = new Intersection(nodeId, coords.lat, coords.lon);
        const wayIds = this._nodeToWayIds.get(nodeId) || new Set();
        for (const wayId of wayIds) {
            const street = this.streets.get(wayId);
            if (street) intersection.addStreet(street);
        }
        this.intersections.set(nodeId, intersection);
    }
  }

    /**
   * Main entry point: load the graph centered on a lat/lon.
   *
   * @param {number} lat
   * @param {number} lon
   * @param {number} [radius=5000]  Radius in meters (5000m ~ a few city blocks)
   * @returns {Promise<void>}
   */
  async loadFromCoords(lat, lon, radius = 5) {
    const query = this._buildQuery(lat, lon, radius);
    const osmData = await this._fetchOverpass(query);
    this._parseOsmData(osmData);
  }

  /**
   * Returns the Intersection nearest to a given lat/lon.
   *
   * @param {number} lat
   * @param {number} lon
   * @returns {Intersection|null}
   */
  getNearestIntersection(lat, lon) {
    let nearest = null;
    let minDist = Infinity;
    for (const intersection of this.intersections.values()) {
      const namedStreets = intersection.streets
      .filter(s => !s.isUnnamed);
      if (namedStreets.length == 0) continue;
        const dist = Utils.calculateDistanceBetweenCordinates(lat, lon, intersection.lat, intersection.lon);
        if (dist < minDist) {
            minDist = dist;
            nearest = intersection
        }
    }
    return nearest;
  }

  /**
   * Returns all neighboring intersections reachable from a given intersection,
   * along with the street used to reach them and the direction.
   *
   * @param {string} intersectionId  OSM node ID of the starting intersection
   * @returns {Array<object>}
   */
  getNeighbors(intersectionId) {
    const origin = this.intersections.get(intersectionId);
    if (!origin) return [];
    const neighbors = [];
    for (const street of origin.streets) {
        if (this.unnamedRoadsDisabled && street.isUnnamed) continue;
        const curIndex = street.nodeIds.indexOf(origin.id);
        if (curIndex === -1) continue;
        const directions = [];
        if (curIndex < street.nodeIds.length - 1) directions.push(
            {step: 1, startIndex: curIndex}
        );
        if (curIndex > 0) directions.push(
            {step: -1, startIndex: curIndex}
        );
        for (const {step, startIndex} of directions) {
            let i = startIndex + step;
            while (i >= 0 && i < street.nodeIds.length) {
                const nodeId = street.nodeIds[i];
                if (this.intersections.has(nodeId) && nodeId !== origin.id) {
                    const neighbor = this.intersections.get(nodeId);
                    if (this.unnamedRoadsDisabled) {
                      const namedStreets = 
                      neighbor.streets.filter(s => !s.isUnnamed);
                      const hasCrossStreet = 
                      namedStreets.some(
                        s => !s.isUnnamed && s.label !== street.label
                      );
    if (!hasCrossStreet && i + step >= 0 && i + step < street.nodeIds.length) {
      i += step;
      continue;
    }
                    }
                    const distance = Utils.calculateDistanceBetweenCordinates(
                        origin.lat,
                        origin.lon,
                        neighbor.lat,
                        neighbor.lon
                    );
                    const direction = Utils.cardinalDirection(
                        origin.lat,
                        origin.lon,
                        neighbor.lat,
                        neighbor.lon
                    );
                    neighbors.push({intersection: neighbor, street, angle: Math.round(direction.angle), cardinal: direction.cardinal, distance});
                    break;
                }
                i += step;
            }
        }
    }
    return neighbors
  }

  /**
   * Returns the Intersection object for a given node ID.
   * @param {string} id
   * @returns {Intersection|null}
   */
  getIntersection(id) {
    return this.intersections.get(id) || null;
  }

  /**
   * Returns true if the graph has been loaded and has at least one intersection.
   * @returns {boolean}
   */
  get isLoaded() {
    return this.intersections.size > 0;
  }

  /**
   * Determine the smallest angular adjustment required to align the current
   * bearing with the closest street connected to an intersection.
   * @param {number} currentBearing - Current heading in degrees (0–360).
   * @param {Intersection} intersection - Intersection object containing neighbors().
 * @returns {{
 *   intersection: Intersection,
 *   street: Street,
 *   angle: number,
 *   cardinal: string,
 *   distance: number
 * } | null}   */
  closestNeighborByAngularDiff(currentBearing, intersection) {
      let closestNeighbor = null;
      let bestDiff = Infinity;
      const neighbors = this.getNeighbors(intersection.id);
      if (neighbors.length === 0) return null;
      for (const neighbor of neighbors) {
        const diff = Math.abs(Utils.angleDiff(currentBearing, neighbor.angle));
        if (diff < bestDiff) {
          bestDiff = diff;
          closestNeighbor = neighbor;
        }
      }
      return closestNeighbor;
}

  /**
   * Gets the street to the left based on the current intersection and current heading.
   * @param {Intersection} intersectionId - The current intersection ID
   * @param {number} currentBearing - The current facing direction in degrees
 * @returns {{
 *   intersection: Intersection,
 *   street: Street,
 *   angle: number,
 *   cardinal: string,
 *   distance: number
 * } | null} The neighbor to the left
   */
  getLeftTurn(intersectionId, currentBearing) {
    const neighbors = this.getNeighbors(intersectionId);
    if (neighbors.length === 0) return null;
    if (neighbors.length === 1) return neighbors[0];
    let best = null;
    let bestDiff = Infinity;
    for (const neighbor of neighbors) {
      const ccwDiff = (currentBearing - neighbor.angle + 360) % 360;
      if (ccwDiff === 0) continue;
      if (ccwDiff < bestDiff) {
        best = neighbor;
        bestDiff = ccwDiff;
      }
    }
    return best;
  }
  /**
   * Gets the street to the right based on the current intersection and current heading.
   * @param {Intersection} intersectionId - The current intersection ID
   * @param {number} currentBearing - The current facing direction in degrees
 * @returns {{
 *   intersection: Intersection,
 *   street: Street,
 *   angle: number,
 *   cardinal: string,
 *   distance: number
 * } | null} The neighbor to the right
   */
  getRightTurn(intersectionId, currentBearing) {
    const neighbors = this.getNeighbors(intersectionId);
    if (neighbors.length === 0) return null;
    let best = null;
    let bestDiff = Infinity;
    for (const neighbor of neighbors) {
      const cwDiff = (neighbor.angle - currentBearing + 360) % 360;
      if (cwDiff === 0) continue;
      if (cwDiff < bestDiff) {
        best = neighbor;
        bestDiff = cwDiff;
      }
    }
    return best;
  }
}
