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
import { Neighbor } from "./map-neighbor.js";
import * as mapCache from "./map-cache.js";

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
 * Loads OpenStreetMap data into an existing tile.
 * @param {Tile} tile
 */
async loadTile(tile) {
    // Don't reload an already loaded tile.
    if (tile.isLoaded) {
        return true;
    }
    const cachedTile = await mapCache.getTile(tile.key);
    if (cachedTile) {
      tile.nodes = cachedTile.nodes;
      tile.ways = cachedTile.ways;
      tile.isLoaded = true;
      return true;
    }

    const box = tile.bbox;

    const query = `
[out:json][timeout:60];
way["highway"]["highway"!~"footway|path|bridleway|steps|corridor|sidewalk|track"]
(${box.south},${box.west},${box.north},${box.east});
out body;
node(w);
out body;
    `.trim();

    try {
        const data = await this._fetchOverpass(query);

        // If this is a retry, make sure the tile is empty first.
        tile.clear();

        if (data.elements) {
            for (const el of data.elements) {
                if (el.type === "node") {
                    tile.addNode(el.id, {
                        lat: el.lat,
                        lon: el.lon
                    });
                }
                else if (el.type === "way") {
                    tile.addWay(el.id, el);
                }
            }
        }
        await mapCache.saveTile(tile);
        tile.isLoaded = true;
        return true;
    }
    catch (error) {
        console.error(`Failed to load tile ${tile.key}:`, error);

        tile.isLoaded = false;
        return false;
    }
}

/**
 * Checks that all tiles are created based on the given coordinates and the given radius in grid units.
 * If radius = 1, ensures a grid of 1 center tile and 4 surrounding tiles
 *
 * @param {number} lat - Center latitude.
 * @param {number} lon - Center longitude.
 * @param {number} radius - Radius in tile units.
 * @returns {Tile[]}
 */
ensureTilesAround(lat, lon, radius = 1) {
    /** @type {Tile[]} */
    const tiles = [];

    const center = this.latLonToTileXY(lat, lon);
    const offsets = [
    [0, 0],        // Current tile first
    [0, radius],   // North
    [radius, 0],   // East
    [0, -radius],  // South
    [-radius, 0]   // West
];
    for (const [dx, dy] of offsets) {
          const x = center.x + dx;
          const y = center.y + dy;
          const key = `${x}_${y}`;
          let tile;
          if (this.tiles.has(key)) {
              // Tile already exists.
              tile = this.tiles.get(key);
          } else {
              // Create a blank tile.
              const box = this._getTileBoundingBox(x, y);
              tile = new Tile(x, y, box);
              this.tiles.set(tile.key, tile);
          }
          tiles.push(tile);
    }
    return tiles;
}

  _buildEdges() {
  for (const street of this.streets.values()) {
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
        Utils.calculateDistanceBetweenCoordinates(
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
        from.id,
        to.id,
        street,
        distance,
        fromTo.angle,
        fromTo.cardinal
      );

      const edgeBackward = new Edge(
        to.id,
        from.id,
        street,
        distance,
        toFrom.angle,
        toFrom.cardinal
      );

      if (!from.getEdge(edgeForward.id)) {
        from.addEdge(edgeForward.id, edgeForward);
      }

      if (!to.getEdge(edgeBackward.id)) {
        to.addEdge(edgeBackward.id, edgeBackward);
      }

      prevIntersection = nodeId;
    }
  }
  }

/**
 * Integrates a tile into the global street graph.
 * Creates streets, detects intersections, and builds edges.
 * @param {Tile} tile
 */
integrateTile(tile) {
  if (tile.nodes.size === 0 || tile.ways.size === 0) return;

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
  }

  // ---- Build edges between intersections ----
  this._buildEdges();
}

/**
 * Announces the progress of tile loading.
 *
 * @param {HTMLElement} mount - Element where the announcement is rendered.
 * @param {number} current - Number of tiles completed.
 * @param {number} total - Total number of tiles to load.
 */
announceLoadingProgress(mount, current, total) {
    const percent = Math.min(
      Math.round((current / total) * 100), 100
    );

    Utils.srAnnounce(
        mount,
        `
        <div role="status" aria-live="polite">
            <p>Loading intersections (${current} of ${total})...</p>

            <div
                class="progress"
                aria-label="Loading progress"
                aria-valuemin="0"
                aria-valuemax="${total}"
                aria-valuenow="${current}"
            >
                <div
                    class="progress-bar"
                    role="progressbar"
                    style="width: ${percent}%"
                    aria-valuenow="${percent}"
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                    ${percent}%
                </div>
            </div>
        </div>
        `
    );
}

/**
 * Loads the road graph for the specified location.
 *
 * Ensures that all tiles surrounding the given coordinates exist, then
 * attempts to load each unloaded tile from OpenStreetMap. Each tile is
 * retried up to a fixed number of times before being skipped. Successfully
 * loaded tiles are integrated into the graph and their temporary data is
 * discarded to reduce memory usage. Tiles that fail to load remain marked
 * as unloaded so they can be retried later by {@link refreshRoadData}.
 *
 * @param {number} lat - The center latitude of the area to load.
 * @param {number} lon - The center longitude of the area to load.
 * @param {HTMLElement} [mount=null] - The element where the loading progress occurs, if null, no announcements
 * @param {number} [maxRetries=5] The number of retries for each request, default 5 
 * @returns {Promise<boolean>} Resolves to `true` when the loading process
 * completes, or `false` if an unexpected error occurs.
 */
async loadGraph(lat, lon, mount = null, maxRetries = 5) {
    try {
        const tiles = this.ensureTilesAround(lat, lon);
        const tileTotal = tiles.length;
        let loaded = 0;
        if (mount) this.announceLoadingProgress(mount, loaded, tileTotal);
        for (const tile of tiles) {
            // Already loaded on a previous call.
            if (tile.isLoaded) {
                continue;
            }
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                const success = await this.loadTile(tile);
                if (success) {
                    this.integrateTile(tile);
                    tile.clear();
                    break;
                }
                console.warn(
                    `Tile ${tile.key} failed (attempt ${attempt}/${maxRetries}).`
                );
                if (attempt < maxRetries) {
                    await Utils.sleep(5000 * attempt); // Exponential backoff
                }
            }
            loaded++;
            if (mount) this.announceLoadingProgress(mount, loaded, tileTotal);
        }
        return true;
    } catch (error) {
        console.error("Loading error:", error);
        return false;
    }
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
      const namedStreets = [...intersection.edges.values()].filter(e => !e.segment.isUnnamed);
      if (namedStreets.length === 0) continue;

      const dist = Utils.calculateDistanceBetweenCoordinates(
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
   * @returns {Array<Neighbor>}
   */
getNeighbors(intersectionId) {
  const origin = this.intersections.get(intersectionId);
  if (!origin) return [];

  const neighbors = [];

  const pushOrMergeNeighbor = (candidate, referenceAngle) => {
    const existing = neighbors.find(
      n =>
        n.originIntersectionId === candidate.originIntersectionId &&
        n.nextIntersectionId === candidate.nextIntersectionId
    );

    if (!existing) {
      neighbors.push(candidate);
      return;
    }

    const existingDiff = Math.abs(Utils.angleDiff(referenceAngle, existing.angle));
    const candidateDiff = Math.abs(Utils.angleDiff(referenceAngle, candidate.angle));

    if (candidateDiff < existingDiff) {
      const idx = neighbors.indexOf(existing);
      neighbors[idx] = candidate;
    }
  };

  for (const edge of origin.edges.values()) {

    if (this.unnamedRoadsDisabled && edge.segment.isUnnamed) continue;

    // If unnamed roads are allowed, include direct neighbors
    if (!this.unnamedRoadsDisabled) {
      neighbors.push(
        new Neighbor(
          origin.id,
          edge.to,
          edge.segment.id,
          edge.angle,
          edge.cardinal,
          edge.distance
        )
      );
      continue;
    }

    let currentEdge = edge;
    let currentIntersection = this.getIntersection(edge.to);
    const visited = new Set();

    while (true) {
      const angleAndDirection = Utils.getBearingAndDirection(
        origin.lat, origin.lon,
        currentIntersection.lat, currentIntersection.lon
      );
      const distance = Utils.calculateDistanceBetweenCoordinates(
        origin.lat, origin.lon,
        currentIntersection.lat, currentIntersection.lon
      );
      if (visited.has(currentIntersection.id)) {
        pushOrMergeNeighbor(
          new Neighbor(
            origin.id,
            currentIntersection.id,
            currentEdge.segment.id,
            angleAndDirection.angle,
            angleAndDirection.cardinal,
            distance
          ),
          angleAndDirection.angle
        );
        break;
      }

      visited.add(currentIntersection.id);

      const intersectionEdges = [...currentIntersection.edges.values()];
      const namedEdges = intersectionEdges.filter(e => !e.segment.isUnnamed);

      const sameStreetEdges = namedEdges.filter(
        e => e.segment.key === currentEdge.segment.key
      );

      const hasCrossStreet = namedEdges.some(
        e => e.segment.key !== currentEdge.segment.key
      );

      if (hasCrossStreet || sameStreetEdges.length >= 3) {
        pushOrMergeNeighbor(
          new Neighbor(
            origin.id,
            currentIntersection.id,
            currentEdge.segment.id,
            angleAndDirection.angle,
            angleAndDirection.cardinal,
            distance
          ),
          angleAndDirection.angle
        );
        break;
      }

      const candidates = intersectionEdges.filter(e =>
        e.segment.key === currentEdge.segment.key &&
        e.to !== currentEdge.from
      );

      if (candidates.length === 0) {
        pushOrMergeNeighbor(
          new Neighbor(
            origin.id,
            currentIntersection.id,
            currentEdge.segment.id,
            angleAndDirection.angle,
            angleAndDirection.cardinal,
            distance
          ),
          angleAndDirection.angle
        );
        break;
      }

      let nextEdge;

      if (candidates.length === 1) {
        nextEdge = candidates[0];
      } else {
        const currentAngle = currentEdge.angle;

        nextEdge = candidates.reduce((best, e) => {
          if (!best) return e;

          const bestDiff = Math.abs(Utils.angleDiff(currentAngle, best.angle));
          const diff = Math.abs(Utils.angleDiff(currentAngle, e.angle));

          return diff < bestDiff ? e : best;
        }, null);
      }

      currentEdge = nextEdge;
      currentIntersection = this.getIntersection(nextEdge.to);
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
   * Gets the street based on the given ID.
   * Returns a street if found, null otherwise 
   * @param {string} streetId 
   * @returns {Street|null}
   */
  getStreet(streetId) {
    return this.streets.get(streetId) || null;
  }
  
  /**
   * Returns the neighbor whose bearing is closest to the given heading.
   *
   * @param {number}       currentBearing  Current heading in degrees (0–360)
   * @param {Array<Neighbor>} neighbors    The list of neighbors
   * @returns {Neighbor | null}
   */
  closestNeighborByAngularDiff(currentBearing, neighbors) {
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
   * @param {number} currentBearing   Current heading in degrees (0–360)
   * @param {Array<Neighbor>} neighbors The list of neighbor objects
   * @returns {Neighbor | null}
   */
  getLeftTurn(currentBearing, neighbors) {
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
   * @param {number} currentBearing   Current heading in degrees (0–360)
   * @param {Array<Neighbor>} neighbors A list of neighbor objects
   * @returns {Neighbor | null}
   */
  getRightTurn(currentBearing, neighbors) {
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

  /**
   * Locates the neighbor from the set of neighbors with the largest angle separation based on the given heading
   * First, the closest neighbor is determined. The neighbor is used to get the current street
   * If there is 0 neighbors, null is returned
   * If there is one neighbor, the current neighbor will just be returned
   * Returns the neighbor with the largest angle separation from the current neighbor
   * @param {number} heading 
   * @param {Array<Neighbor>} neighbors 
   * @returns {Neighbor | null}
   */
  getAround(heading, neighbors) {
    if (neighbors.length === 0 && neighbors.length === 1) return null;
    const currentNeighbor = this.closestNeighborByAngularDiff(heading, neighbors);
    const normalize = (angle) => ((angle % 360) + 360) % 360;
    const angleDiff = (a, b) => {
      const diff = Math.abs(normalize(a) - normalize(b));
      return Math.min(diff, 360 - diff);
    };
    const currentAngle = currentNeighbor.angle;
    const currentStreetKey = this.getStreet(currentNeighbor.wayId).key;
    const neighborWithSameStreets = neighbors.filter(n => this.getStreet(n.wayId).key === currentStreetKey);
    if (neighborWithSameStreets.length === 0) return null;
    if (neighborWithSameStreets.length === 1 && this.getStreet(neighborWithSameStreets[0].wayId).id === this.getStreet(currentNeighbor.wayId).id) return null;
    if (neighborWithSameStreets.length === 1) return neighborWithSameStreets[0];
    return neighborWithSameStreets.reduce((best, n) => {
      if (!best) return n;
      const bestDiff = angleDiff(currentAngle, best.angle);
      const diff = angleDiff(currentAngle, n.angle);
      return diff > bestDiff ? n : best;
    }, null);
  }

  /**
   * Gets the relative direction given a heading and a set of neighbors 
   * {number} currentHeading -  The heading in degrees 
   * @param {Array<Neighbor>} neighbors 
   * @returns {{
   * left: Array<Neighbor>,
   * right: Array<Neighbor>,
   * ahead: Array<Neighbor>,
   * behind: Array<Neighbor>
   * }}
   */
  getRelativeDirections(currentHeading, neighbors) {
    const result = {
      left: [],
      right: [],
      ahead: [],
      behind: []
    };
    const normalize = (angle) => {
      return ((angle + 540) % 360) -180;
    }
    for (const neighbor of neighbors) {
      const diff = normalize(neighbor.angle - currentHeading);
      if (diff >= -45 && diff <= 45) result.ahead.push(neighbor);
      else if (diff > 45 && diff <= 135) result.right.push(neighbor);
      else if (diff < -45 && diff >= -135) result.left.push(neighbor);
      else result.behind.push(neighbor);
    }
    return result;
  }

  clear() {
    this._nodeToWays.clear();
    this._nodes.clear();
    this.intersections.clear();
    this.streets.clear();
    this.tiles.clear();
  }

  get isLoaded() {
    return this.intersections.size > 0;
  }

  /**
 * Retrieves an existing tile or creates a new blank tile.
 *
 * Returns the tile at the specified grid coordinates if it already
 * exists. Otherwise, a new tile is created with the appropriate
 * bounding box, added to the tile map, and returned. This function
 * does not load any road data into the tile.
 *
 * @param {number} x - The tile's x-coordinate.
 * @param {number} y - The tile's y-coordinate.
 * @returns {Tile} The existing or newly created tile.
 */
  getOrCreateTile(x, y) {
    const key = `${x}_${y}`;
    if (this.tiles.has(key)) {
      return this.tiles.get(key);
    }
    const bbox = this._getTileBoundingBox(x, y);
    const tile = new Tile(x, y, bbox);
    this.tiles.set(key, tile);
    return tile;
  }
}
