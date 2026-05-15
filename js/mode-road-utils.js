import { switchApplicationView } from "./loader.js";

import { Street } from "./map-street.js";
import { Intersection } from "./map-intersection.js";
import { Neighbor } from "./map-neighbor.js";
import { state } from "./state.js";
import * as Utils from "./UtilFunctions.js";

//Fail safe function: return to explore mode.
const returnToExploreMode = () => {
  document.getElementById("announcements-mount").innerHTML = "";
    switchApplicationView(
        "pages/mode-explore.html",
        document.getElementById("app-mount"),
        initExploreMode
    );
};

export const relativeDirectionToString = (heading, neighbors) => {
  let directionsString = "";
  const result = state.intersection_graph.getRelativeDirections(heading, neighbors);
  const directionLabels = {
    left: "goes left",
    right: "goes right",
    ahead: "continues ahead",
    behind: "continues behind"
  };
  for (const [direction, phrase] of Object.entries(directionLabels)) {
    const seen = new Set();
    const list = result[direction]
    .map(n => state.intersection_graph.getStreet(n.wayId).label)
    .filter(name => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    if (!list || list.length === 0) continue;
    for (const label of list) {
      directionsString += `<p>${label}, ${phrase}</p>`;
    }
  }
  return directionsString;
};

export const initData = async (statusElement, announcementsElement) => {
  if (state.intersection_graph.isLoaded) return;
    Utils.srAnnounce(statusElement, `Loading intersections.`);
    Utils.srAnnounce(
      announcementsElement,
      `<div class="d-flex align-items-center gap-2" role="status" aria-live="polite">
  <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
  <span>Loading intersections...</span>
</div>`
    );
      let announcements = "";

        const fetchResponse = await state.intersection_graph.loadGraph(state.lat, state.lon);
        if (!fetchResponse) {
          Utils.srAnnounce(
              status,
              `Unable to load intersection data. Returning to explorer mode. Click the "Switch to road mode" button to try again.`
          );
          returnToExploreMode();
          return;
        }

        const closestIntersection = state.intersection_graph.getNearestIntersection(
          state.lat, state.lon
        );
        const intersectionAnnouncements = updateIntersection(state.current_heading, closestIntersection.id, false);
      // Step 1: Snap to the nearest named intersection
      if (!closestIntersection) {
        Utils.srAnnounce(statusElement, `Unable to be placed on a road. Returning to free explore mode.`);
        returnToExploreMode();
        return;
      }
      Utils.srAnnounce(statusElement, `${intersectionAnnouncements.originIntersectionStr}`);

      // Step 2: Align heading to the nearest street by angular proximity
      const alignStr = updateAlignment(state.current_heading, closestIntersection.id, "", true);
      announcements += `${alignStr}`;

      // Step 3: Set state and announce the next intersection along the aligned street
    state.lat = closestIntersection.lat;
    state.lon = closestIntersection.lon;
    state.current_intersection = closestIntersection.id;
      const tileCoords = state.intersection_graph.latLonToTileXY(state.lat, state.lon);
      state.current_tile = `${tileCoords.x}_${tileCoords.y}`;
    const url = `?mode=road&coords=${state.lat},${state.lon}`;
    history.pushState({}, "", url);
      Utils.srAnnounce(announcementsElement, announcements);
};

/**
 * Moves to an intersection based on the given intersection ID
 * intersectionId is optional. If intersectionId is empty, the nearest named intersection will be used
 * if unable to be placed on an intersection, null will be returned
 * Next intersection is determined based on the given heading
 * If updateState flag is set to true, changes happen to state variables 
 * Returns an object containing the origin intersection string and the next intersection string  with distance, along with the best neighbor by angular difference
 * @param {number} heading The heading indegrees between 0 and 359
 * @param {string} intersectionId The starting intersection ID
 * @param {boolean} updateState Flag that determines if the state should be updated
 * @returns {{originIntersectionStr: string, nextIntersectionStr: string} | null}
 */
export const updateIntersection= (heading, intersectionId, updateState = false) => {
    const originIntersection = state.intersection_graph.getIntersection(intersectionId);
    const neighbors = state.intersection_graph.getNeighbors(intersectionId);
    const neighbor = state.intersection_graph.closestNeighborByAngularDiff(heading, neighbors);
  const nextIntersection = state.intersection_graph.getIntersection(neighbor.nextIntersectionId);
  const originIntersectionStr = originIntersection.description;
  const nextIntersectionStr = `Next intersection: ${nextIntersection.description}, ${Utils.printDistance(neighbor.distance)}`;
  if (updateState) {
    state.location_history.push({
      lat: state.lat,
      lon: state.lon,
      intersection: originIntersection.id
    });
    state.lat = nextIntersection.lat;
    state.lon = nextIntersection.lon;
    state.current_intersection = nextIntersection.id;
      const tileCoords = state.intersection_graph.latLonToTileXY(state.lat, state.lon);
      state.current_tile = `${tileCoords.x}_${tileCoords.y}`;
    const url = `?mode=road&coords=${state.lat},${state.lon}`;
    history.pushState({}, "", url);
  }
  return {originIntersectionStr, nextIntersectionStr, neighbor};
};

/**
 * Announces the alignment on a street based on the given heading and intersection ID
 * Updates the state variables and returns a string for announcing
 * if includeRelativeDirections flag is set to true, the resulting string will also include relative directions
 * If a direction is included, left, or right, the neighbor in that direction will be chosen
 * Otherwise, the neighbor by the closest angular difference will be chosen
 * @param {number} heading The current heading in degrees from 0 to 359
 * @param {string} intersectionId The id of the intersection
 * @param {string} direction The direction to turn, left or right
 * @param {boolean} includeRelativeDirections The flag determining if relative directions should be included in the resulting string
 * @returns {string}
 */
export const updateAlignment = (heading, intersectionId, direction, includeRelativeDirections) => {
  const neighbors = state.intersection_graph.getNeighbors(intersectionId);
  let neighbor = null;
  if (!direction) {
    neighbor = state.intersection_graph.closestNeighborByAngularDiff(heading, neighbors);
  } else if (direction === "left") {
    neighbor = state.intersection_graph.getLeftTurn(heading, neighbors);
  } else {
    neighbor = state.intersection_graph.getRightTurn(heading, neighbors);
  }
  state.current_neighbor = neighbor;
  state.current_heading = Utils.updateHeading(neighbor.angle);
  const street = state.intersection_graph.getStreet(neighbor.wayId);
  let relativeDirStr = "";
  if (includeRelativeDirections) relativeDirStr = relativeDirectionToString(
    heading, neighbors
  );
  const nextIntersection = state.intersection_graph.getIntersection(neighbor.nextIntersectionId);
  return `${relativeDirStr}
  <p>On ${street.label}, heading ${neighbor.cardinalDirection}</p>
    <p>Next intersection: ${nextIntersection.description}, ${Utils.printDistance(neighbor.distance)}</p>`;
};

    const updateTiles = async () => {
      const updateUi = () => {
      const intersectionAnnouncements = updateIntersection(state.current_heading, state.current_intersection, false);
      const alignAnnouncements = updateAlignment(state.current_heading, state.current_intersection, "", true);
        Utils.srAnnounce(document.getElementById("status-text"), `Current intersection: ${intersectionAnnouncements.originIntersectionStr}`);
        Utils.srAnnounce(document.getElementById("announcements-mount"), `${alignAnnouncements}`);
      };

      const currentTileKey = state.current_tile;
      const tile = state.intersection_graph.tiles.get(currentTileKey);
      if (!tile) {
        await state.intersection_graph.loadGraph(state.lat, state.lon);
        updateUi();
        return;
      }
      const directions = ["north", "east", "south", "west"];
      const direction = directions[
        Math.floor((state.current_heading + 45) / 90) % 4
      ];
      let distance = 0;
      switch (direction) {
        case "north":
          distance = Utils.calculateDistanceBetweenCordinates(state.lat, state.lon, tile.bbox.north, state.lon);
          break;
          case "east":
            distance = Utils.calculateDistanceBetweenCordinates(state.lat, state.lon, state.lat, tile.bbox.east);
            break;
            case "south":
              distance = Utils.calculateDistanceBetweenCordinates(state.lat, state.lon, tile.bbox.south, state.lon);
              break;
              case "west":
                distance = Utils.calculateDistanceBetweenCordinates(state.lat, state.lon, state.lat, tile.bbox.west);
                break;
      }
      if (distance <= 1000) {
        await state.intersection_graph.loadGraph(state.lat, state.lon);
        updateUi();
      }
    };
