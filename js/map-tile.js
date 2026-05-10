/**
 * Represents a spatial tile of OpenStreetMap data.
 *
 * A Tile is a cached bounding-box unit used for incremental loading
 * of map data. It stores raw OSM nodes and ways before they are
 * integrated into the global IntersectionGraph.
 */
export class Tile {
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
