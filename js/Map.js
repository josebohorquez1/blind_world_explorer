/**
 * Map.js
 *
 * Builds a navigable street graph from OpenStreetMap data via the Overpass API.
 * Designed for a nonvisual intersection explorer (screen reader friendly).
 *
 * Exports:
 *   IntersectionGraph  -- main graph class; fetches, parses, and traverses OSM data
 *
 * Internal classes:
 *   Street       -- a named OSM way (road segment) between two intersections
 *   Intersection -- an OSM node where two or more streets meet
 *   Edge         -- a directed connection between two adjacent intersections
 */

import * as Utils from "./UtilFunctions.js";
import { Street } from "./map-street.js";
import { Edge } from "./map-edge.js";
import { Intersection } from "./map-intersection.js";
import { Tile } from "./map-tile.js";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";


/**
 * A graph of intersections connected by streets, built from OpenStreetMap data.
 *
 * Nodes: Intersection instances, keyed by OSM node ID.
 * Edges: Directed Edge instances attached to each Intersection, derived from shared Street.nodeIds.
 *
 * Responsibilities:
 *   - Fetch OSM way/node data from the Overpass API
 *   - Parse OSM elements into Street, Intersection, and Edge objects
 *   - Expose spatial queries: nearest intersection, neighbors, turn directions
 */
export class IntersectionGraph {
  constructor() {
    /** @type {Map<string, {lat: number, lon: number}>} */
    this._nodes = new Map();

    /** @type {Map<string, Intersection>}  All intersections, keyed by OSM node ID */
    this.intersections = new Map();

    /** @type {Map<string, Street>}  All streets, keyed by OSM way ID */
    this.streets = new Map();

    /**
     * Index of OSM node ID → set of way IDs passing through that node.
     * Used during construction to detect intersection nodes (shared by 2+ ways).
     * @type {Map<string, Set<string>>}
     */
    this._nodeToWays = new Map();

    /** @type{Map<string, Tile} The map containing the tiles. The key is determined by x-coordinate_y-coordinate */
    this.tiles = new Map();

    /**
     * When true, unnamed roads are skipped during neighbor traversal,
     * and getNeighbors walks through unnamed nodes until a named cross-street is found.
     */
    this.unnamedRoadsDisabled = true;
  }

  /**
   * POSTs a query to the Overpass API and returns the parsed JSON response.
   *
   * @param {string} query  Overpass QL query string
   * @returns {Promise<object>}  Raw Overpass JSON response
   * @throws {Error}  On non-OK HTTP response
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
 * Returns a padded geographic bounding box for a tile.
 *
 * Tile is 1km × 1km in Web Mercator space, with 200m padding
 * added on all sides to prevent edge-cutting roads/intersections.
 *
 * @param {number} x  Tile X index
 * @param {number} y  Tile Y index
 * @returns {{south:number, west:number, north:number, east:number}}
 */
_getTileBoundingBox(x, y) {
  const TILE_SIZE = 5000;
  const PADDING = 200;

  const R = 6378137;

  // Convert tile bounds to meters
  const minX = x * TILE_SIZE;
  const maxX = (x + 1) * TILE_SIZE;

  const minY = y * TILE_SIZE;
  const maxY = (y + 1) * TILE_SIZE;

  // Apply padding in meters
  const paddedMinX = minX - PADDING;
  const paddedMaxX = maxX + PADDING;
  const paddedMinY = minY - PADDING;
  const paddedMaxY = maxY + PADDING;

  // Convert meters → lon/lat
  const west = (paddedMinX / R) * (180 / Math.PI);
  const east = (paddedMaxX / R) * (180 / Math.PI);

  const south = (2 * Math.atan(Math.exp(paddedMinY / R)) - Math.PI / 2) * (180 / Math.PI);
  const north = (2 * Math.atan(Math.exp(paddedMaxY / R)) - Math.PI / 2) * (180 / Math.PI);

  return { south, west, north, east };
}

/**
 * Converts latitude/longitude into 1km Web Mercator tile coordinates.
 *
 * Tiles are defined in a 1000m × 1000m grid using Web Mercator meters.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {{x: number, y: number}}
 */
latLonToTileXY(lat, lon) {
  const R = 6378137; // Web Mercator radius
  const TILE_SIZE = 5000;

  // Convert lon → meters (X)
  const xMeters = R * lon * Math.PI / 180;

  // Convert lat → meters (Y)
  const yMeters =
    R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));

  // Convert meters → tile indices
  const x = Math.floor(xMeters / TILE_SIZE);
  const y = Math.floor(yMeters / TILE_SIZE);

  return { x, y };
}

  /**
   * Fetches nodes and ways for a tile given x and y coordinates
   * A new tile is created, and the nodes and ways are added to the tile.
   * The tile is then stored into the tile  map.
   * Returns true on success or false on failure.
   * @param {number} x - The x-coordinate of the tile
   * @param {number} y - The y-coordinate of the tile
   * Returns the new tile or null if no tile was created
   * @returns {Tile || null}
   */
  async loadTile(x, y) {
    const box = this._getTileBoundingBox(x, y);
const query = `
[out:json][timeout:60];
way["highway"]["highway"!~"footway|path|cycleway|bridleway|steps|corridor|sidewalk|track"]
(${box.south},${box.west},${box.north},${box.east});
out body;
node(w);
out body;
    `.trim();
    try {
    const data = await this._fetchOverpass(query);
    if (!data.elements) return null;
    const tile = new Tile(x, y, box);
    for (const el of data.elements) {
      if (el.type === "node") {
        tile.addNode(
        el.id,
        {lat: el.lat, lon: el.lon}
      );
      continue;
      }
      if (el.type === "way") tile.addWay(el.id, el);
    }
    this.tiles.set(tile.key, tile);
    return tile;
    } catch (error) {
      console.log(`Fetching error: ${error}`);
      return null;
    }
  }

  /**
   * Checks that all tiles are created based on the given coordinates and the given radius in grid units 
   * If radius = 1, function ensures 3x3 tiles are surrounding the coordinates 
   * If radius = 2, function ensures 5x5 tiles are surrounding the coordinates 
   * @param {number} lat - The center lattitude 
   * @param {number} lon - The center longitude 
   * @param {number} radius - Used to calculate the tiles grid 
   * Returns a list of new tiles 
   * @returns {Tile[]}
   */
  async ensureTilesAround(lat, lon, radius=1) {
    /** @type {Tile[]}  A list of new tiles */
    const tiles = [];
    const center = this.latLonToTileXY(lat, lon);
    for (let dx = -radius; dx < radius; dx++) {
      for (let dy = -radius; dy < radius; ++ dy) {
        const x = center.x + dx;
        const y = center.y + dy;
        const key = `${x}_${y}`;
        try {
          if (!this.tiles.has(key)) {
            const tile = await this.loadTile(x, y);
            if (tile) tiles.push(tile);
            await Utils.sleep(500);
          }
        }
        catch (error) {
          console.log(error);
          return [];
        }
      }
    }
    return tiles;
  }

/**
 * Integrates a tile into the global street graph.
 * Creates streets, detects intersections, and builds edges.
 * @param {Tile} tile
 */
integrateTile(tile) {

  /** @type {Street[]} Streets created from this tile */
  const streetList = [];

  // ---- Merge tile nodes into global node map ----
  for (const [nodeId, node] of tile.nodes) {
    if (!this._nodes.has(nodeId)) {
      this._nodes.set(nodeId, node);
    }
  }

  // ---- Create / reuse Street objects ----
  for (const [wayId, way] of tile.ways) {

    let street = this.streets.get(wayId);

    if (!street) {
      street = new Street(way);
      this.streets.set(street.id, street);
    }

    streetList.push(street);
  }

  // ---- Build node → ways map ----
  for (const street of streetList) {
    for (const nodeId of street.nodeIds) {

      if (!this._nodeToWays.has(nodeId)) {
        this._nodeToWays.set(nodeId, new Set());
      }

      this._nodeToWays.get(nodeId).add(street.id);
    }
  }

  // ---- Detect intersection nodes ----
  const intersectionNodes = new Set();

  for (const [nodeId, ways] of this._nodeToWays.entries()) {
    if (ways.size >= 2) intersectionNodes.add(nodeId);
  }

  // also treat endpoints as intersections
  for (const street of streetList) {
    if (street.nodeIds.length === 0) continue;

    intersectionNodes.add(street.beginningNode);
    intersectionNodes.add(street.endNode);
  }

  // ---- Build Intersection objects ----
  for (const nodeId of intersectionNodes) {

    const nodeData = this._nodes.get(nodeId);
    if (!nodeData) continue;

    const { lat, lon } = nodeData;

    if (!this.intersections.has(nodeId)) {
      this.intersections.set(
        nodeId,
        new Intersection(nodeId, lat, lon)
      );
    }

    const intersection = this.intersections.get(nodeId);
    const ways = this._nodeToWays.get(nodeId);
    if (!ways) continue;

    for (const wayId of ways) {
      const street = this.streets.get(wayId);
      if (street) intersection.addStreet(street);
    }
  }

  // ---- Build edges between intersections ----
  for (const street of streetList) {

    let prevIntersection = null;

    for (const nodeId of street.nodeIds) {

      if (!this.intersections.has(nodeId)) continue;

      if (!prevIntersection) {
        prevIntersection = nodeId;
        continue;
      }

      const from = this.intersections.get(prevIntersection);
      const to = this.intersections.get(nodeId);

      const distance =
        Utils.calculateDistanceBetweenCordinates(
          from.lat,
          from.lon,
          to.lat,
          to.lon
        );

      const fromTo =
        Utils.getBearingAndDirection(
          from.lat,
          from.lon,
          to.lat,
          to.lon
        );

      const toFrom =
        Utils.getBearingAndDirection(
          to.lat,
          to.lon,
          from.lat,
          from.lon
        );

      const edgeForward = new Edge(
        from,
        to,
        street,
        distance,
        fromTo.angle,
        fromTo.cardinal
      );

      const edgeBackward = new Edge(
        to,
        from,
        street,
        distance,
        toFrom.angle,
        toFrom.cardinal
      );

      if (!from.edges.has(edgeForward.id)) {
        from.addEdge(edgeForward.id, edgeForward);
      }

      if (!to.edges.has(edgeBackward.id)) {
        to.addEdge(edgeBackward.id, edgeBackward);
      }

      prevIntersection = nodeId;
    }
  }
}

  async loadGraph(lat, lon) {
    try {
    const tiles = await this.ensureTilesAround(lat, lon);
    for (const tile of tiles) {
      this.integrateTile(tile);
      tile.clear();
    }
    console.log(this.intersections);
    } catch (error) {
      console.log(`Loading error: ${error}`);
      throw error;
      return false;
    }
    return true;
  }

  /**
   * Returns the nearest intersection (with at least one named street) to the given coordinates.
   *
   * @param {number} lat
   * @param {number} lon
   * @returns {Intersection|null}
   */
  getNearestIntersection(lat, lon) {
    let nearest = null;
    let minDist = Infinity;

    for (const intersection of this.intersections.values()) {
      // Skip intersections with no named streets — they are not useful navigation targets
      const namedStreets = intersection.streets.filter(s => !s.isUnnamed);
      if (namedStreets.length === 0) continue;

      const dist = Utils.calculateDistanceBetweenCordinates(
        lat, lon,
        intersection.lat, intersection.lon
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = intersection;
      }
    }
    return nearest;
  }

  /**
   * Returns all reachable neighboring intersections from the given intersection.
   *
   * When `unnamedRoadsDisabled` is true, unnamed road edges are skipped and the
   * traversal walks forward along the same street label until it finds a node with
   * a cross-street (a true named intersection). This collapses chains of unnamed
   * intermediate nodes into a single neighbor entry.
   *
   * @param {string} intersectionId  OSM node ID of the starting intersection
   * @returns {Array<{
   *   intersection: Intersection,
   *   street: Street,
   *   angle: number,
   *   cardinal: string,
   *   distance: number
   * }>}
   */
  getNeighbors(intersectionId) {
    const origin = this.intersections.get(intersectionId);
    if (!origin) return [];

    const neighbors = [];

    for (const edge of origin.edges.values()) {
      if (this.unnamedRoadsDisabled && edge.street.isUnnamed) continue;

      // When unnamed roads are enabled, include all direct edges as-is
      if (!this.unnamedRoadsDisabled) {
        neighbors.push({
          intersection: edge.to,
          street: edge.street,
          angle: edge.angle,
          cardinal: edge.cardinal,
          distance: edge.distance,
        });
        continue;
      }

      // Walk forward along this street until a meaningful named intersection is found
      let currentEdge = edge;
      let currentIntersection = edge.to;
      const visited = new Set();

      while (true) {
        // Cycle guard: if we've looped back, emit current position and stop
        if (visited.has(currentIntersection.id)) {
          neighbors.push({
            intersection: currentIntersection,
            street: currentEdge.street,
            angle: currentEdge.angle,
            cardinal: currentEdge.cardinal,
            distance: Utils.calculateDistanceBetweenCordinates(
              origin.lat, origin.lon,
              currentIntersection.lat, currentIntersection.lon
            ),
          });
          break;
        }
        visited.add(currentIntersection.id);

        const namedStreets = currentIntersection.streets.filter(s => !s.isUnnamed);
        const streetsWithSameLabel = namedStreets.reduce(
          (count, s) => (s.label === currentEdge.street.label ? count + 1 : count),
          0
        );
        const hasCrossStreets = namedStreets.some(
          s => s.label !== currentEdge.street.label
        );

        // Stop if there's a cross-street or the same label forks (3+ segments = junction)
        if (hasCrossStreets || streetsWithSameLabel >= 3) {
          neighbors.push({
            intersection: currentIntersection,
            street: currentEdge.street,
            angle: currentEdge.angle,
            cardinal: currentEdge.cardinal,
            distance: Utils.calculateDistanceBetweenCordinates(
              origin.lat, origin.lon,
              currentIntersection.lat, currentIntersection.lon
            ),
          });
          break;
        }

        // Advance: find the continuing edge on the same street, excluding backtracking
        const nextEdge = [...currentIntersection.edges.values()].find(
          e => e.street.label === currentEdge.street.label
            && e.to.id !== currentEdge.from.id
        );
        if (!nextEdge) {
          // Dead end: emit current position
          neighbors.push({
            intersection: currentIntersection,
            street: currentEdge.street,
            angle: currentEdge.angle,
            cardinal: currentEdge.cardinal,
            distance: Utils.calculateDistanceBetweenCordinates(
              origin.lat, origin.lon,
              currentIntersection.lat, currentIntersection.lon
            ),
          });
          break;
        }

        currentEdge = nextEdge;
        currentIntersection = nextEdge.to;
      }
    }

    return neighbors;
  }

  /**
   * Returns the Intersection for the given OSM node ID.
   *
   * @param {string} id
   * @returns {Intersection|null}
   */
  getIntersection(id) {
    return this.intersections.get(id) || null;
  }

  /**
   * Returns the neighbor whose bearing is closest to the given heading.
   *
   * @param {number}       currentBearing  Current heading in degrees (0–360)
   * @param {Intersection} intersection    The intersection to query neighbors from
   * @returns {{
   *   intersection: Intersection,
   *   street: Street,
   *   angle: number,
   *   cardinal: string,
   *   distance: number
   * } | null}
   */
  closestNeighborByAngularDiff(currentBearing, intersection) {
    const neighbors = this.getNeighbors(intersection.id);
    if (neighbors.length === 0) return null;

    let closestNeighbor = null;
    let bestDiff = Infinity;

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
   * Returns the neighbor reachable by the smallest left (counter-clockwise) turn
   * from the current heading.
   *
   * @param {string} intersectionId   OSM node ID of the current intersection
   * @param {number} currentBearing   Current heading in degrees (0–360)
   * @returns {{
   *   intersection: Intersection,
   *   street: Street,
   *   angle: number,
   *   cardinal: string,
   *   distance: number
   * } | null}
   */
  getLeftTurn(intersectionId, currentBearing) {
    const neighbors = this.getNeighbors(intersectionId);
    if (neighbors.length === 0) return null;
    if (neighbors.length === 1) return neighbors[0];

    let best = null;
    let bestDiff = Infinity;

    for (const neighbor of neighbors) {
      // Counter-clockwise angular distance from currentBearing to neighbor.angle
      const ccwDiff = (currentBearing - neighbor.angle + 360) % 360;
      if (ccwDiff === 0) continue; // Straight ahead is not a left turn
      if (ccwDiff < bestDiff) {
        best = neighbor;
        bestDiff = ccwDiff;
      }
    }

    return best;
  }

  /**
   * Returns the neighbor reachable by the smallest right (clockwise) turn
   * from the current heading.
   *
   * @param {string} intersectionId   OSM node ID of the current intersection
   * @param {number} currentBearing   Current heading in degrees (0–360)
   * @returns {{
   *   intersection: Intersection,
   *   street: Street,
   *   angle: number,
   *   cardinal: string,
   *   distance: number
   * } | null}
   */
  getRightTurn(intersectionId, currentBearing) {
    const neighbors = this.getNeighbors(intersectionId);
    if (neighbors.length === 0) return null;
    if (neighbors.length === 1) return neighbors[0];

    let best = null;
    let bestDiff = Infinity;

    for (const neighbor of neighbors) {
      // Clockwise angular distance from currentBearing to neighbor.angle
      const cwDiff = (neighbor.angle - currentBearing + 360) % 360;
      if (cwDiff === 0) continue; // Straight ahead is not a right turn
      if (cwDiff < bestDiff) {
        best = neighbor;
        bestDiff = cwDiff;
      }
    }

    return best;
  }

  clear() {
    this._nodeToWays.clear();
    this._nodes.clear();
    this.intersections.clear();
    this.streets.clear();
    this.tiles.clear();
  }
}
