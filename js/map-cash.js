/**
 * @file map_cache.js
 *
 * Provides a persistent cache for downloaded map tiles using the
 * browser's IndexedDB API. Cached tiles are stored locally so they can
 * be reused without repeatedly downloading the same road data from the
 * Overpass API, improving performance and reducing network requests.
 *
 * The cache stores each tile's coordinates, bounding box, road network
 * data, and the time it was cached. Cached tiles may be refreshed or
 * replaced when they exceed the maximum cache age.
 */

//Importing the Tile class
import { Tile } from "./map-tile.js";

/** @type {IDBDatabase | null} */
let cacheDb = null;
/** Maximum age of a cached tile (30 days). */
const MAX_TILE_AGE = 30 * 24 * 60 * 60 * 1000;

/**
 * Initializes the tile cache database.
 *
 * Opens the IndexedDB database used to cache downloaded map tiles.
 * If the database or object store does not already exist, they are
 * created automatically. This function should be called once when the
 * application starts before any cache operations are performed.
 *
 * @returns {Promise<void>} Resolves when the cache has been initialized.
 */
export async function initCache() {
    if (cacheDb) return;
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("IntersectionCache", 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("tiles")) {
                db.createObjectStore("tiles", {
                    keyPath: "key"
                });
            }
        };
        request.onsuccess = (event) => {
            cacheDb = event.target.result;
            resolve();
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Saves a tile to the local cache.
 *
 * Stores the given tile in the IndexedDB cache. If a tile with the same
 * key already exists, it is replaced with the new data.
 *
 * @param {Tile} tile - The tile to cache.
 * @returns {Promise<void>} Resolves when the tile has been saved.
 */
export async function saveTile(tile) {
    ensureCacheInitialized();
    return new Promise((resolve, reject) => {
        const transaction = cacheDb.transaction("tiles", "readwrite");
        const store = transaction.objectStore("tiles");
        store.put({
            key: tile.key,
            x: tile.x,
            y: tile.y,
            bbox: tile.bbox,
            nodes: tile.nodes,
            ways: tile.ways,
            timestamp: Date.now()
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

/**
 * Retrieves a tile from the local cache.
 *
 * Looks up the tile with the given key in the IndexedDB cache. If the
 * tile exists, the cached tile data is returned. Otherwise, null is
 * returned.
 *
 * @param {string} key - The unique key identifying the tile.
 * @returns {Promise<Object|null>} Resolves to the cached tile data if
 * found; otherwise, null.
 */
export async function getTile(key) {
    ensureCacheInitialized();
    return new Promise((resolve, reject) => {
        const transaction = cacheDb.transaction("tiles", "readonly");
        const store = transaction.objectStore("tiles");
        const request = store.get(key);
        request.onsuccess = () => {
            const tile = request.result;
            if (!tile) {
                resolve(null);
                return;
            }
            if (Date.now() - tile.timestamp > MAX_TILE_AGE) {
                await deleteTile(key);
                resolve(null);
                return;
            }
            resolve(tile);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Deletes a tile from the local cache.
 *
 * Removes the cached tile with the specified key from the IndexedDB
 * database. If no tile with the given key exists, no action is taken.
 *
 * @param {string} key - The unique key identifying the tile to delete.
 * @returns {Promise<void>} Resolves when the tile has been removed from
 * the cache.
 */
export async function deleteTile(key) {
    ensureCacheInitialized();
    return new Promise((resolve, reject) => {
        const transaction = cacheDb.transaction("tiles", "readwrite");
        const store = transaction.objectStore("tiles");
        store.delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

/**
 * Deletes all cached tiles from the local cache.
 *
 * Removes every tile stored in the IndexedDB cache. This operation
 * permanently clears the tile cache and is typically used to reset
 * cached map data.
 *
 * @returns {Promise<void>} Resolves when the cache has been cleared.
 */
export async function clearTilesFromCache() {
    ensureCacheInitialized();
    return new Promise((resolve, reject) => {
        const transaction = cacheDb.transaction("tiles", "readwrite");
        const store = transaction.objectStore("tiles");
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

/**
 * Ensure the cache is initialized
 * Used to prevent functions from making a connection to an uninitialized database
 */
function ensureCacheInitialized() {
  if (!cacheDb) {
    throw new Error("Error: Cache not initialized.");
  }

}