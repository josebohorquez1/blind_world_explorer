import { switchApplicationView } from "./loader.js";
import { Street } from "./map-street.js";
import { Intersection } from "./map-intersection.js";
import { Neighbor } from "./map-neighbor.js";
import { state } from "./state.js";
import * as Utils from "./UtilFunctions.js";
import { initExploreMode } from "./mode-explore.js";

//Variables
const statusMount = document.getElementById("status-text");
const announcementsMount = document.getElementById("announcements-mount");
let isUpdating = false;

//Fail safe function: return to explore mode.
export const returnToExploreMode = () => {
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

export const initData = async () => {
  if (state.intersection_graph.isLoaded) return;
    Utils.srAnnounce(statusMount, `Loading intersections.`);
    Utils.srAnnounce(
      announcementsMount,
      `<div class="d-flex align-items-center gap-2" role="status" aria-live="polite">
  <div class="spinner-border spinner-border-sm" aria-hidden="true"></div>
  <span>Loading intersections...</span>
</div>`
    );
      let announcements = "";

        const fetchResponse = await state.intersection_graph.loadGraph(state.lat, state.lon);
        if (!fetchResponse) {
          Utils.srAnnounce(statusMount, `Unable to load intersection data. Returning to explorer mode. Click the "Switch to road mode" button to try again.`);
          returnToExploreMode();
          return;
        }

        const closestIntersection = state.intersection_graph.getNearestIntersection(
          state.lat, state.lon
        );
      // Step 1: Snap to the nearest named intersection
      if (!closestIntersection) {
        Utils.srAnnounce(statusMount, `Unable to be placed on a road. Returning to free explore mode.`);
        returnToExploreMode();
        return;
      }

      // Step 2: Align heading to the nearest street by angular proximity
      const alignStr = updateAlignment(state.current_heading, closestIntersection.id, "", true);
        const intersectionAnnouncements = updateIntersection(state.current_heading, closestIntersection.id, false);
            Utils.srAnnounce(statusMount, `${intersectionAnnouncements.originIntersectionStr}`);
      announcements += `${alignStr}`;

      // Step 3: Set state and announce the next intersection along the aligned street
    state.lat = closestIntersection.lat;
    state.lon = closestIntersection.lon;
    state.current_intersection = closestIntersection.id;
      const tileCoords = state.intersection_graph.latLonToTileXY(state.lat, state.lon);
      state.current_tile = `${tileCoords.x}_${tileCoords.y}`;
    const url = `?mode=road&coords=${state.lat},${state.lon}`;
    history.pushState({}, "", url);
      Utils.srAnnounce(announcementsMount, announcements);
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
  return {originIntersectionStr, nextIntersectionStr};
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
  } else if (direction === "around") {
    neighbor = state.intersection_graph.getAround(heading, neighbors);
  } else {
    neighbor = state.intersection_graph.getRightTurn(heading, neighbors);
  }
  if (!neighbor) return `<p>Unable to turn.</p>`;
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

    export const updateTiles = async () => {
      if (isUpdating) return;
      isUpdating = true;
      const updateUi = () => {
      const intersectionAnnouncements = updateIntersection(state.current_heading, state.current_intersection, false);
      const alignAnnouncements = updateAlignment(state.current_heading, state.current_intersection, "", true);
        Utils.srAnnounce(document.getElementById("status-text"), `Current intersection: ${intersectionAnnouncements.originIntersectionStr}`);
        Utils.srAnnounce(document.getElementById("announcements-mount"), `${alignAnnouncements}`);
      };

      const currentTileKey = state.current_tile;
      const tile = state.intersection_graph.tiles.get(currentTileKey);
      if (!tile) {
      Utils.srAnnounce(
        document.getElementById("announcements-mount"),
        `<p>Attempting to update intersections for further exploration.</p>
        <p>You may continue to navigate while intersections load.</p>
        <p>If the update seemed  to have failed, press the refresh button to try again.</p>`
      );
      document.getElementById("nav-refresh-road").disabled = true;
        await state.intersection_graph.loadGraph(state.lat, state.lon);
        updateUi();
        document.getElementById("nav-refresh-road").disabled = false;
        isUpdating = false;
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
      Utils.srAnnounce(
        document.getElementById("announcements-mount"),
        `<p>Attempting to update intersections for further exploration.</p>
        <p>You may continue to navigate while intersections load.</p>
        <p>If the update seemed  to have failed, press the refresh button to try again.</p>`
      );
      document.getElementById("nav-refresh-road").disabled = true;
        await state.intersection_graph.loadGraph(state.lat, state.lon);
        updateUi();
      }
      document.getElementById("nav-refresh-road").disabled = false;
      isUpdating = false;
    };

  export const switchToExploreMode = () => {
        const url = location.origin + location.pathname;
        history.replaceState({}, "", url);
          state.current_heading = 0;
          state.current_moving_distance = 90;
          state.current_neighbor = null;
          state.current_rotation_increment = 45;
          state.current_tile = "";
          state.intersection_graph.clear();
          state.lat = 0;
          state.location_history= [];
          state.lon = 0;
          switchApplicationView(
          "pages/start.html",
          document.getElementById("app-mount"),
          initStartScreen
        );
      };

      export const refreshRoadData = async () => {
          for (const btn of document.getElementsByTagName("button")) btn.disabled = true;
          Utils.srAnnounce(announcementsMount, `<p>Attempting to to refresh unloaded intersections.</p>
            <p>If you feel like expected intersections were not added, press the refresh button again when available.</p>`);
          await state.intersection_graph.loadGraph(state.lat, state.lon);
          for (const tile of state.intersection_graph.tiles.values()) {
            if (!tile.isLoaded) {
              await state.intersection_graph.reloadTile(tile);
              if (!tile.isLoaded) continue;
              state.intersection_graph.integrateTile(tile);
              tile.clear();
              await Utils.sleep(1000);
            }
          }
          Utils.srAnnounce(announcementsMount, `${updateAlignment(state.current_heading, state.current_intersection, "", true)}`);
          for (const btn of document.getElementsByTagName("button")) btn.disabled = false;
          };

          export const toggleUnnamedRoads = (event) => {
                const getNeighbors = () => {
          const alignAnnouncement = updateAlignment(state.current_heading,state.current_intersection, "", true);
          Utils.srAnnounce(announcementsMount, `${alignAnnouncement}`);
                };
                state.intersection_graph.unnamedRoadsDisabled = !state.intersection_graph.unnamedRoadsDisabled;
                if (!state.intersection_graph.unnamedRoadsDisabled) {
                  event.currentTarget.setAttribute("aria-label", "Disable unnamed roads");
                  event.currentTarget.setAttribute("data-bs-title", "Disable unnamed roads");
              const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
              const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
              getNeighbors();
                }
                else {
                  event.currentTarget.setAttribute("aria-label", "Enable unnamed roads");
                  event.currentTarget.setAttribute("data-bs-title", "Enable unnamed roads");
              const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
              const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
              getNeighbors();
                }
              };

              export const movePrevious = () => {
                  if (state.location_history.length === 0) {
                    Utils.srAnnounce(announcementsMount,
                      `<p>There are no previous points. Navigate to an intersection in road mode or explore freely to create previous points.</p>`
                    );
                    return;
                  }
                  let announcements = "";
              
                  const lastPoint = state.location_history[state.location_history.length - 1];
                  const currentLat = state.lat;
                  const currentLon = state.lon;
                  const { lat: prevLat, lon: prevLon, intersection: prevIntersection } = lastPoint;
                  let currentIntersection = null;
                    if (!prevIntersection) {
                      // History entry came from explorer mode — snap to the nearest intersection instead
                      announcements += `<p>The previous point does not contain intersection data. Placing you at the nearest intersection.</p>`;
                      currentIntersection = state.intersection_graph.getNearestIntersection(prevLat, prevLon);
                    }
              else {
                    // Restore to the previously visited named intersection
                    currentIntersection = state.intersection_graph.getIntersection(prevIntersection);
                    announcements += `<p>Returning to previously visited intersection.</p>`;
              }
              
              const alignAnnouncement = updateAlignment(state.current_heading, currentIntersection.id, "", true);
                    Utils.srAnnounce(statusMount, `Current intersection: ${currentIntersection.description}`);
                    announcements += `${alignAnnouncement}`;
              
                    state.lat = prevLat;
                    state.lon = prevLon;
                    state.current_intersection = prevIntersection;
                    state.location_history.pop();
                    Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
                };

                export const turnLeft = () => {
      // Select the neighbor reachable by the smallest counter-clockwise turn
      const alignAnnouncement = updateAlignment(state.current_heading, state.current_intersection, "left", false);
      Utils.srAnnounce(announcementsMount, `<p>${alignAnnouncement}</p>`);
  };

  export const moveForward = async () => {
      let announcements = "";

      // Step 1: Advance to the previously announced next intersection
      const oldCurrentIntersection = state.intersection_graph.getIntersection(state.current_intersection);
      const newIntersectionAnnouncements = updateIntersection(state.current_heading, state.current_intersection, true);
      const alignAnnouncement = updateAlignment(state.current_heading, state.current_intersection, "", true);
      const newCurrentIntersection = state.intersection_graph.getIntersection(state.current_intersection);

      // Step 2: Calculate distance traveled and announce arrival
      const distance = Utils.calculateDistanceBetweenCordinates(
        oldCurrentIntersection.lat, oldCurrentIntersection.lon,
        newCurrentIntersection.lat, newCurrentIntersection.lon
      );
      const direction = Utils.getBearingAndDirection(
        oldCurrentIntersection.lat, oldCurrentIntersection.lon,
        newCurrentIntersection.lat, newCurrentIntersection.lon
      ).cardinal;
      Utils.srAnnounce(statusMount, `Current intersection: ${newCurrentIntersection.description}.`);
      announcements += `<p>Moved ${Utils.printDistance(distance)} ${direction}</p>
      ${alignAnnouncement}`;

      // Step 3: Announce the upcoming intersection
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
      //Wait 5 seconds before updates occur to allow for previous announcements to show up
      await Utils.sleep(2000);
      await updateTiles();
  };

  export const turnRight = () => {
      // Select the neighbor reachable by the smallest clockwise turn
      const alignAnnouncement = updateAlignment(state.current_heading, state.current_intersection, "right", false);
      Utils.srAnnounce(announcementsMount, `${alignAnnouncement}`);
  };

  export const turnAround = () => {
    const alignmentAnnouncement = updateAlignment(state.current_heading, state.current_intersection, "around", false);
      Utils.srAnnounce(announcementsMount, `${alignmentAnnouncement}`);
  };

  export const toggleMenu = (event) => {
    const menu = document.getElementById("menu");
    const isHidden = (menu.hidden === true);
    event.currentTarget.setAttribute("aria-expanded", String(isHidden));
    menu.hidden = !isHidden;
  };
