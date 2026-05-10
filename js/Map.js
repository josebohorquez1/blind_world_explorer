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

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** OSM highway types excluded from the graph (non-drivable/non-walkable roads). */
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
 * Fields:
 *   id              {string}       OSM way ID
 *   name            {string|null}  Road name (e.g. "University Avenue")
 *   ref             {string|null}  Road reference number (e.g. "US-441")
 *   highwayType     {string}       OSM highway tag value (e.g. "residential")
 *   junctionType    {string|null}  OSM junction tag value (e.g. "roundabout")
 *   destination     {string|null}  OSM destination tag (e.g. "Downtown")
 *   destinationRef  {string|null}  OSM destination:ref tag (e.g. "I-75")
 *   destinationStreet {string|null} OSM destination:street tag
 *   junctionRef     {string|null}  OSM junction:ref tag (exit number)
 *   nodeIds         {string[]}     Ordered OSM node IDs along this way
 */
class Street {
  /**
   * @param {object} osmWay  Raw OSM way element from an Overpass JSON response
   */
  constructor(osmWay) {
    this.id = String(osmWay.id);
    this.name = osmWay.tags?.name || null;
    this.ref = osmWay.tags?.ref || null;
    this.highwayType = osmWay.tags?.highway || "road";
    this.junctionType = osmWay.tags?.junction || null;
    this.destination = osmWay.tags?.destination || null;
    this.destinationRef = osmWay.tags?.["destination:ref"] || null;
    this.destinationStreet = osmWay.tags?.["destination:street"] ?? null;
    this.junctionRef = osmWay.tags?.["junction:ref"] || null;
    this.nodeIds = (osmWay.nodes || []).map(String);
  }

  /**
   * Human-readable display label for this street, derived from available OSM tags.
   *
   * Priority: name > ref > highway-type fallback > "Road".
   * For motorway links, builds an "Exit N to X towards Y" or "Ramp to X" string.
   *
   * @returns {string}
   */
  get label() {
    if (this.name) return this.name;
    if (this.ref) return this.ref;
    if (this.highwayType === "service") return "Service Road";
    if (this.highwayType === "residential") return "Residential Street";
    if (this.junctionType === "roundabout") return "Roundabout";

    if (
      this.highwayType === "primary_link"
      || this.highwayType === "secondary_link"
      || this.highwayType === "tertiary_link"
    ) return "Merging Lane";

    if (this.highwayType === "motorway_link") {
      const hasNoSignage = (
        !this.junctionRef
        && !this.destinationRef
        && !this.destination
        && !this.destinationStreet
      );
      if (hasNoSignage) return "Ramp";

      if (this.junctionRef) {
        return (
          `Exit ${this.junctionRef}`
          + `${this.destinationRef ? ` to ${this.destinationRef}` : ``}`
          + `${this.destination ? ` towards ${this.destination}` : ``}`
        );
      }

      // Combine ref and street name if both are present (e.g. "I-75 Main Street")
      const toText = (this.destinationRef && this.destinationStreet)
        ? `${this.destinationRef} ${this.destinationStreet}`
        : this.destinationRef || this.destinationStreet || "";

      return (
        `Ramp`
        + `${toText ? ` to ${toText}` : ``}`
        + `${this.destination ? ` towards ${this.destination}` : ``}`
      );
    }

    return "Road";
  }

  /**
   * Given one endpoint node ID, returns the opposite endpoint node ID.
   *
   * Used during traversal: given intersection A on this street, find the
   * intersection at the other end of this segment.
   *
   * @param {string} fromNodeId  Starting endpoint node ID
   * @returns {string|null}  The other endpoint node ID, or null if fromNodeId is not an endpoint
   */
  otherEndFrom(fromNodeId) {
    if (this.nodeIds[0] === fromNodeId) return this.nodeIds[this.nodeIds.length - 1];
    if (this.nodeIds[this.nodeIds.length - 1] === fromNodeId) return this.nodeIds[0];
    return null;
  }

  /**
   * Returns whether the given node ID is the first or last node of this street.
   *
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
   * True if this street has no meaningful identifying label:
   * no name, no ref, not a roundabout, and not a motorway link.
   *
   * @returns {boolean}
   */
  get isUnnamed() {
    return (
      !this.ref
      && !this.name
      && this.junctionType !== "roundabout"
      && this.highwayType !== "motorway_link"
    );
  }

  /**
   * Returns the beginning node
   */
  get beginningNode() {
    return this.nodeIds[0];
  }

  get endNode() {
    return this.nodeIds[this.nodeIds.length - 1];
  }
}

/**
 * A directed connection between two adjacent intersection nodes along a street.
 *
 * Fields:
 *   from     {Intersection}  Origin intersection
 *   to       {Intersection}  Destination intersection
 *   street   {Street}        The street this edge follows
 *   distance {number}        Distance in meters between from and to
 *   angle    {number}        Bearing in degrees (0–360) from from to to
 *   cardinal {string}        Cardinal direction label (e.g. "North", "Southwest")
 */
class Edge {
  /**
   * @param {Intersection} from
   * @param {Intersection} to
   * @param {Street}       street
   * @param {number}       distance  Meters
   * @param {number}       angle     Bearing in degrees
   * @param {string}       cardinal  Cardinal direction label
   */
  constructor(from, to, street, distance, angle, cardinal) {
    this.from = from;
    this.to = to;
    this.street = street;
    this.distance = distance;
    this.angle = angle;
    this.cardinal = cardinal;
  }
  get id() {
    return `${this.from.id}_${this.to}_${this.street}`
  }
}

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
    /** @type {Map<string, Edge>} */
    this.edges = new Map();
  }

  /**
   * Adds a street to this intersection, skipping duplicates by ID.
   *
   * @param {Street} street
   */
  addStreet(street) {
    if (!this.streets.find((s) => s.id === street.id)) {
      this.streets.push(street);
    }
  }

  /**
   * Appends a directed edge departing from this intersection.
   *
   * @param {Edge} edge
   */
  addEdge(edge) {
    this.edges.push(edge);
  }

  /**
   * Deduplicated list of display labels for all streets at this intersection.
   *
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

/**
 * Represents a spatial tile of OpenStreetMap data.
 *
 * A Tile is a cached bounding-box unit used for incremental loading
 * of map data. It stores raw OSM nodes and ways before they are
 * integrated into the global IntersectionGraph.
 */
class Tile {
  /**
   * @param {number} x  Tile X index (grid coordinate)
   * @param {number} y  Tile Y index (grid coordinate)
   * @param {{south:number, west:number, north:number, east:number}} bbox
   */
  constructor(x, y, bbox) {
    this.x = x;
    this.y = y;
    this.bbox = bbox;

    /**
     * Raw OSM node data within this tile.
     * @type {Map<string, {lat:number, lon:number}>}
     */
    this.nodes = new Map();

    /**
     * Raw OSM way data within this tile.
     * @type {Map<string, object>}
     */
    this.ways = new Map();
  }

  /**
   * Adds a node to the tile.
   *
   * @param {string} id
   * @param {{lat:number, lon:number}} node
   */
  addNode(id, node) {
    this.nodes.set(String(id), node);
  }

  /**
   * Adds a way to the tile.
   *
   * @param {string} id
   * @param {object} way
   */
  addWay(id, way) {
    this.ways.set(String(id), way);
  }

  /**
   * Returns a simple tile key used for caching.
   *
   * @returns {string}
   */
  get key() {
    return `${this.x}_${this.y}`;
  }

  /**
   * Clears stored data to free memory.
   */
  clear() {
    this.nodes.clear();
    this.ways.clear();
  }
}

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
  const TILE_SIZE = 1000;
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
_latLonToTileXY(lat, lon) {
  const R = 6378137; // Web Mercator radius
  const TILE_SIZE = 1000;

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
   * @returns {boolean}
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
    const data = await this._fetchOverpass(query);
    if (!data.elements) return false;
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
    return true;
  }

  /**
   * Checks that all tiles are created based on the given coordinates and the given radius in grid units 
   * If radius = 1, function ensures 3x3 tiles are surrounding the coordinates 
   * If radius = 2, function ensures 5x5 tiles are surrounding the coordinates 
   * @param {number} lat - The center lattitude 
   * @param {number} lon - The center longitude 
   * @param {number} radius - Used to calculate the tiles grid 
   */
  async ensureTilesAround(lat, lon, radius=1) {
    const center = this._latLonToTileXY(lat, lon);
    for (let dx = -radius; dx < radius; dx++) {
      for (let dy = -radius; dy < radius; ++ dy) {
        const x = center.x + dx;
        const y = center.y + dy;
        const key = `${x}_${y}`;
        try {
          if (this.tiles.has(key)) await this.loadTile(x, y);
        }
        catch (error) {
          throw error;
        }
      }
    }
  }

  /**
   * Builds directed Edge objects between all adjacent intersection nodes for each street.
   *
   * Iterates each street's ordered node list, connecting consecutive intersection
   * nodes with a forward and backward Edge (treating all streets as bidirectional).
   */
  _buildEdges() {
    for (const street of this.streets.values()) {
      const nodes = street.nodeIds;
      let lastIntersection = null;

      for (const node of nodes) {
        if (!this.intersections.has(node)) continue;
        if (!lastIntersection) {
          lastIntersection = node;
          continue;
        }

        const from = this.intersections.get(lastIntersection);
        const to = this.intersections.get(node);

        const forwardDirection = Utils.getBearingAndDirection(
          from.lat, from.lon,
          to.lat, to.lon
        );
        const distance = Utils.calculateDistanceBetweenCordinates(
          from.lat, from.lon,
          to.lat, to.lon
        );

        const forwardEdge = new Edge(
          from, to, street,
          distance,
          Math.round(forwardDirection.angle),
          forwardDirection.cardinal
        );

        const reverseDirection = Utils.getBearingAndDirection(
          to.lat, to.lon,
          from.lat, from.lon
        );
        const backwardEdge = new Edge(
          to, from, street,
          distance,
          Math.round(reverseDirection.angle),
          reverseDirection.cardinal
        );

        from.addEdge(forwardEdge);
        to.addEdge(backwardEdge);
        lastIntersection = node;
      }
    }
  }

/**
 * Integrates a tile into the global street graph.
 * Creates streets, detects intersections, and builds edges.
 * @param {Tile} tile
 */
integrateTile(tile) {

  /** Streets created from this tile */
  const streetList = [];

  // ---- Create Street objects ----
  for (const way of tile.ways) {
    const street = new Street(way);
    this.streets.set(way.id, street);
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

    const nodeData = tile.nodes.get(nodeId);
    if (!nodeData) continue;

    const { lat, lon } = nodeData;

    if (!this.intersections.has(nodeId)) {
      this.intersections.set(nodeId, new Intersection(nodeId, lat, lon));
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

      const distance = Utils.calculateDistanceBetweenCordinates(
        from.lat,
        from.lon,
        to.lat,
        to.lon
      );

      const fromTo = Utils.getBearingAndDirection(
        from.lat,
        from.lon,
        to.lat,
        to.lon
      );

      const toFrom = Utils.getBearingAndDirection(
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

      if (!from.edges.has(edgeForward.id)) from.addEdge(edgeForward);
      if (!to.edges.has(edgeBackward.id)) to.addEdge(edgeBackward);

      prevIntersection = nodeId;
    }
  }
}

  /**
   * Parses an Overpass JSON response into the graph's internal data structures.
   * Clears all existing graph data before parsing.
   *
   * Steps:
   *   1. Index all node coordinates.
   *   2. Build Street objects from OSM ways (excluding filtered highway types).
   *   3. Build the nodeToWayIds index.
   *   4. Identify intersection nodes (shared by 2+ ways, or street endpoints).
   *   5. Create Intersection objects, attach streets, and build edges.
   *
   * @param {object} osmData  Parsed Overpass JSON response
   */
  _parseOsmData(osmData) {
    this.intersections.clear();
    this.streets.clear();
    this._nodeToWayIds.clear();
    this._nodeCoords.clear();

    const elements = osmData.elements || [];
    if (elements.length === 0) return;

    // Step 1: Index all node coordinates
    for (const el of elements) {
      if (el.type === "node") {
        this._nodeCoords.set(String(el.id), { lat: el.lat, lon: el.lon });
      }
    }

    // Step 2: Build Street objects, filtering excluded highway types
    for (const el of elements) {
      if (el.type !== "way") continue;
      if (!el.tags?.highway) continue;
      if (EXCLUDED_HIGHWAY_TYPES.has(el.tags.highway)) continue;
      const street = new Street(el);
      this.streets.set(street.id, street);
    }

    // Step 3: Map each node to the set of ways passing through it
    for (const street of this.streets.values()) {
      for (const nodeId of street.nodeIds) {
        if (!this._nodeToWayIds.has(nodeId)) this._nodeToWayIds.set(nodeId, new Set());
        this._nodeToWayIds.get(nodeId).add(street.id);
      }
    }

    // Step 4: A node is an intersection if it belongs to 2+ ways, or is a street endpoint
    const intersectionNodes = new Set();
    for (const [nodeId, wayIds] of this._nodeToWayIds.entries()) {
      if (wayIds.size >= 2) intersectionNodes.add(nodeId);
    }
    for (const street of this.streets.values()) {
      if (street.nodeIds.length === 0) continue;
      intersectionNodes.add(street.nodeIds[0]);
      intersectionNodes.add(street.nodeIds[street.nodeIds.length - 1]);
    }

    // Step 5: Create Intersection objects and attach their streets
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

    this._buildEdges();
  }

  async loadFromCoords(lat, lon, radius = 8) {
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

    for (const edge of origin.edges) {
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
        const nextEdge = currentIntersection.edges.find(
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
   * True if the graph has been loaded and contains at least one intersection.
   *
   * @returns {boolean}
   */
  get isLoaded() {
    return this.intersections.size > 0;
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
}
