import { Tile } from "./map-tile.js";

/** @type {IDBDatabase | null} */
let cacheDb = null;

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
    return new Promise((resolve, reject) => {
        const transaction = cacheDb.transaction("tiles", "readonly");
        const store = transaction.objectStore("tiles");
        const request = store.get(key);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}
