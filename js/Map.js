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

    /** @type {Map<string, Intersection>}  All intersections, keyed by OSM node ID */
    this._intersections = new Map();

    /** @type {Map<string, Street>}  All streets, keyed by OSM way ID */
    this._streets = new Map();

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
way["highway"]["highway"!~"bridleway|steps|corridor|sidewalk|track"]
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
                    tile.addNode(el.id, el);
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

/**
 * Creates new street objects using ways
 * Street objects are the ways, or segments that make up an entire true street or road
 * We add any new street to the global street map
 * If the street object already exists, we skip it.
 * We skip it since OSM already gives us the complete way
 * However, when loading new tiles, OSM can gives us ways we already found through previous tiles.
 * Returns the new streets that were created
 * 
 * @param {Map<string, Object>} ways - A map of key way IDs and value OSM way objects
 * @returns {Street[]}
 */
_buildStreets(ways) {
  const streets = [];
  for (const [wayId, way] of ways) {
    if (!this.getStreet(wayId)) {
      const street = new Street(way);
      this._streets.set(wayId, street);
      streets.push(street);
    }
  }
  return streets;
}

/**
  * Matches a OSM node to a set of OSM ways connecting to this node
 * An intersection is a node made up of the ways that have this node in common
 * Creates a map of key node IDs and value set of ways
 * 
 * @param {Object[]} ways - a list of OSM way objectss
 * @returns {Map<string, Set<string>>}
 */
_findWaysThatShareNode(ways) {

  /** @type {Map<string, Set<string>>}*/
  const nodeToWays = new Map();

  for (const way of ways) {
    const nodes = (way.nodes || []).map(String);
    if (!nodes.length) continue;
    for (const node of nodes) {
      if (!nodeToWays.has(node)) {
        nodeToWays.set(node, new Set());
      }
      nodeToWays.get(node).add(way.id);
    }
  }
  return nodeToWays;
}

/**
 * Creates new Intersection objects
 * Uses a map of nodes sharing a set of ways
 * Uses the tile's list of nodes to get the coordinates
 * Uses the newly created streets to add endpoints as intersections, if not already the case
 * We add endpoints as deadends are themselves navigable intersections
 * Adds the newly created intersection objects to the graph
 * 
 * @param {Map<string, Set<string>>} nodeToWays - A map of key nodeId and value set of ways that share that node
 * @param {Map<string, Object>} nodes - The map of nodes from the tile containing key nodeId, and value OSM node
 * @param {Street[]} streets - a list of streets used to add endpoint as intersections
 */
_buildIntersections(nodeToWays, nodes, streets) {
  const intersectionSet = new Set();
  for (const [node, ways] of nodeToWays) {
    if (ways.size >= 2) {
      intersectionSet.add(node);
    }
  }
  for (const street of streets) {
    if (street.nodeIds.length === 0) continue;
    intersectionSet.add(street.beginningNode);
    intersectionSet.add(street.endNode);
  }
  for (const nodeId of intersectionSet) {
    const nodeData = nodes.get(nodeId);
    if (!nodeData) continue;
    if (!this._intersections.has(nodeId)) {
      this._intersections.set(
        nodeId, new Intersection(nodeData)
      );
    }
  }
}

/**
 * Builds edges connecting one intersection to the next
 * edges are built based on the nodes and ways in each tile
 * Existing intersections have their edges cleared to ensure that nee are up to date
 * Edges are global in the graph
 * 
 * @param {string[]} ways - A list of wayIds
 */
_buildEdges(ways) {
  for (const wayId of ways) {
    const street = this._streets.get(wayId);
    if (!street) continue;
    let prev = null;
    for (const node of street.nodeIds) {
      const intersection = this._intersections.get(node);
      if (!intersection) continue;
      for (const [edgeId, edge] of intersection.edges) {
        if (edge.segment.id === street.id) {
          intersection.edges.delete(edgeId);
        }
      }
    }
    for (const node of street.nodeIds) {
      if (!this._intersections.has(node)) continue;
      if (!prev) {
        prev = node;
        continue;
      }
      const from = this._intersections.get(prev);
      const to = this._intersections.get(node);
      const distance = Utils.calculateDistanceBetweenCoordinates(
        from.lat, from.lon,
        to.lat, to.lon
      );
      const fromTo = Utils.getBearingAndDirection(
        from.lat, from.lon,
        to.lat, to.lon
      );
      const toFrom = Utils.getBearingAndDirection(
        to.lat, to.lon,
        from.lat, from.lon
      );
      const fromToEdge = new Edge(
        from.id, to.id,
        street, distance,
        fromTo.angle, fromTo.cardinal
      );
      const toFromEdge = new Edge(
        to.id, from.id,
        street, distance,
        toFrom.angle, toFrom.cardinal
      );
      from.addEdge(fromToEdge.id, fromToEdge);
      to.addEdge(toFromEdge.id, toFromEdge);
      prev = node;
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
  const nodes = tile.nodes;
  const ways = tile.ways;
  const streets = this._buildStreets(ways);
  const nodeToWays = this._findWaysThatShareNode(ways);
  this._buildIntersections(nodeToWays, nodes, streets);
  this._buildEdges(ways.keys());
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
    for (const intersection of this._intersections.values()) {
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
  const origin = this.getIntersection(intersectionId);
  if (!origin) return [];

  /**@type Neighbor[] */
  const neighbors = [];

  const pushOrMergeNeighbor = (candidate) => {
    const existingNeighbor = neighbors.find(n => (
      n.originIntersectionId === candidate.originIntersectionId
      && n.nextIntersectionId === candidate.nextIntersectionId
    ));
    if (existingNeighbor) return;
    neighbors.push(candidate);
  }
  for (const edge of origin.edges.values()) {
    if (this.unnamedRoadsDisabled && edge.segment.isUnnamed) continue;
    if (!this.unnamedRoadsDisabled) {
      neighbors.push(new Neighbor(
        origin.id,
        edge.to,
        edge.segment.id,
        edge.angle,
        edge.cardinal,
        edge.distance
      ));
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
        pushOrMergeNeighbor(new Neighbor(
          origin.id,
          currentIntersection.id,
          currentEdge.segment.id,
          angleAndDirection.angle,
          angleAndDirection.cardinal,
          distance
        ));
        break;
      }
      visited.add(currentIntersection.id);
      const currentIntersectionEdges = [...currentIntersection.edges.values()];
      const namedEdges = currentIntersectionEdges.filter(e => !e.segment.isUnnamed);
      const sameStreetEdges = namedEdges.filter(e => (
        e.segment.key === currentEdge.segment.key
      ));
      const hasCrossStreets = namedEdges.some(e => (
        e.segment.key !== currentEdge.segment.key
      ));
      if (hasCrossStreets) {
        pushOrMergeNeighbor(new Neighbor(
          origin.id,
          currentIntersection.id,
          currentEdge.segment.id,
          angleAndDirection.angle,
          angleAndDirection.cardinal,
          distance
        ));
        break;
      }
      const candidates = sameStreetEdges.filter(e => e.to !== currentEdge.from);
      const uniqueDestinations = new Set(
        candidates.map(e => e.to)
      );
      if (uniqueDestinations.size !== 1) {
        pushOrMergeNeighbor(new Neighbor(
          origin.id,
          currentIntersection.id,
          currentEdge.segment.id,
          angleAndDirection.angle,
          angleAndDirection.cardinal,
          distance
        ));
        break;
      }
      currentEdge = candidates[0];
      currentIntersection = this.getIntersection(currentEdge.to);
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
    return this._intersections.get(id) || null;
  }

  /**
   * Gets the street based on the given ID.
   * Returns a street if found, null otherwise 
   * @param {string} streetId 
   * @returns {Street|null}
   */
  getStreet(streetId) {
    return this._streets.get(streetId) || null;
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
   * @param {Neighbor} currentNeighbor   The current neighbor 
   * @param {Array<Neighbor>} neighbors The list of neighbor objects
   * @returns {Neighbor | null}
   */
  getLeftTurn(currentNeighbor, neighbors) {
    if (neighbors.length === 0) return null;
    if (neighbors.length === 1) return neighbors[0];

    let best = null;
    let bestDiff = Infinity;
    const EPSILON = 0.000001;
    const currentBearing = currentNeighbor.angle;

    for (const neighbor of neighbors) {
      if (
        neighbor.angle === currentNeighbor.angle
        && neighbor.originIntersectionId === currentNeighbor.originIntersectionId
        && neighbor.nextIntersectionId === currentNeighbor.nextIntersectionId
      ) {
        continue;
      }
      // Counter-clockwise angular distance from currentBearing to neighbor.angle
      const ccwDiff = (currentBearing - neighbor.angle + 360) % 360;
      if (ccwDiff < EPSILON) continue; // Straight ahead is not a left turn
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
   * @param {Neighbor} currentNeighbor   The current neighbor in degrees (0–360)
   * @param {Array<Neighbor>} neighbors A list of neighbor objects
   * @returns {Neighbor | null}
   */
  getRightTurn(currentNeighbor, neighbors) {
    if (neighbors.length === 0) return null;
    if (neighbors.length === 1) return neighbors[0];

    let best = null;
    let bestDiff = Infinity;
    const EPSILON = 0.000001;
    const currentBearing = currentNeighbor.angle;

    for (const neighbor of neighbors) {
      if (
        neighbor.angle === currentNeighbor.angle
        && neighbor.originIntersectionId === currentNeighbor.originIntersectionId
        && neighbor.nextIntersectionId === currentNeighbor.nextIntersectionId
      ) {
        continue;
      }
      // Clockwise angular distance from currentBearing to neighbor.angle
      const cwDiff = (neighbor.angle - currentBearing + 360) % 360;
      if (cwDiff < EPSILON) continue; // Straight ahead is not a right turn
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
    this._intersections.clear();
    this._streets.clear();
    this.tiles.clear();
  }

  get isLoaded() {
    return this._intersections.size > 0;
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
