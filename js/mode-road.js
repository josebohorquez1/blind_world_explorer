import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { state } from "./state.js";
import { initStartScreen } from "./Start.js";
import { initExploreMode } from "./mode-explore.js";
import { initRoadMenu } from "./mode-road-menu.js";

//Fail safe function: return to explore mode.
const returnToExploreMode = () => {
  document.getElementById("announcements-mount").innerHTML = "";
    switchApplicationView(
        "pages/mode-explore.html",
        document.getElementById("app-mount"),
        initExploreMode
    );
};

const initData = async () => {
  if (state.intersection_graph.isLoaded) return;
    const announcementsElement = document.getElementById("announcements-mount");
    const status = document.getElementById("status-text");
    Utils.srAnnounce(
      status,
      `Loading intersections.`
    );
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

      // Step 1: Snap to the nearest named intersection
      const closestIntersection = state.intersection_graph.getNearestIntersection(state.lat, state.lon);
      if (!closestIntersection) {
        Utils.srAnnounce(
            status,
            `Unable to be placed on a road. Returning to free explore mode.`
        );
        returnToExploreMode();
        return;
      }
      Utils.srAnnounce(
        status,
        `Current intersection: ${closestIntersection.description}`
      );

      // Step 2: Align heading to the nearest street by angular proximity
      const neighbors = state.intersection_graph.getNeighbors(closestIntersection.id);
      const closestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(
        state.current_heading, neighbors
      );
      state.current_heading = Utils.updateHeading(Math.round(closestNeighbor.angle));
      const street = state.intersection_graph.getStreet(closestNeighbor.wayId);
      const nextIntersection = state.intersection_graph.getIntersection(
        closestNeighbor.nextIntersectionId
      );
      announcements += relativeDirectionToString(closestNeighbor.angle, neighbors);
      announcements += `<p>On ${street.label}, heading ${closestNeighbor.cardinalDirection}</p>`;

      // Step 3: Set state and announce the next intersection along the aligned street
      state.current_neighbor = closestNeighbor;
      state.lat = closestIntersection.lat;
      state.lon = closestIntersection.lon;
      const tileCoords = state.intersection_graph.latLonToTileXY(state.lat, state.lon);
      state.current_tile = `${tileCoords.x}_${tileCoords.y}`;
    const url = `?mode=road&coords=${state.lat},${state.lon}`;
    history.pushState({}, "", url);
      announcements += `<p>Next intersection: ${nextIntersection.description}, ${Utils.printDistance(closestNeighbor.distance)}</p>`;

      Utils.srAnnounce(announcementsElement, announcements);
};

const relativeDirectionToString = (heading, neighbors) => {
  let directionsString = "";
  const result = state.intersection_graph.getRelativeDirections(heading, neighbors);
  const directionLabels = {
    left: "goes left",
    right: "goes right",
    ahead: "continues ahead",
    behind: "continues behind"
  };
  for (const [direction, phrase] of Object.entries(directionLabels)) {
    const list = result[direction];
    if (!list || list.length === 0) continue;
    for (const n of list) {
      const streetLabel = state.intersection_graph.getStreet(n.wayId).label;
      directionsString += `<p>${streetLabel}, ${phrase}</p>`;
    }
  }
  return directionsString;
};

      const updateUi = () => {
        const currentIntersection = state.intersection_graph.getIntersection(
          state.current_neighbor.originIntersectionId
        );
        const neighbors = state.intersection_graph.getNeighbors(
          currentIntersection.id
        );
        Utils.srAnnounce(
          document.getElementById("status-text"),
          `Current intersection: ${currentIntersection.description}`
        );
        const neighbor = state.intersection_graph.closestNeighborByAngularDiff(state.current_heading, neighbors);
        state.current_neighbor = neighbor;
        const street = state.intersection_graph.getStreet(neighbor.wayId);
        const nextIntersection = state.intersection_graph.getIntersection(neighbor.nextIntersectionId);
        Utils.srAnnounce(
          document.getElementById("announcements-mount"),
          `<p>${street.label}, heading ${neighbor.cardinalDirection}</p>
          <p>Next intersection: ${nextIntersection.description}, ${Utils.printDistance(state.current_neighbor.distance)}</p>`
        );
      };

    const updateTiles = async () => {
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
      if (distance <= 1000 || state.intersection_graph.getNeighbors(state.current_neighbor.originIntersectionId).length === 1) {
        await state.intersection_graph.loadGraph(state.lat, state.lon);
        updateUi();
      }
    };

export const initRoadMode = async () => {
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    await Utils.sleep(100);
    for (const btn of document.getElementsByTagName("button")) btn.disabled = true;
    await initData();
    for (const btn of document.getElementsByTagName("button")) btn.disabled = false;
    document.querySelector("#turn-buttons button").focus();
    initRoadMenu();

    document.getElementById("nav-explore-mode").addEventListener("click", () => {
      returnToExploreMode();
    });

    document.getElementById("nav-new-location").addEventListener("click", () => {
      const url = location.origin + location.pathname;
      history.replaceState({}, "", url);
      state.intersection_graph.clear();
      switchApplicationView(
        "pages/start.html",
        document.getElementById("app-mount"),
        initStartScreen
      );
    });
    
    document.getElementById("nav-refresh-road").addEventListener("click", async () => {
    for (const btn of document.getElementsByTagName("button")) btn.disabled = true;
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
    for (const btn of document.getElementsByTagName("button")) btn.disabled = false;
    });

    document.getElementById("nav-toggle-unnamed").addEventListener("click", (e) => {
      const getNeighbors = () => {
        const neighbors = state.intersection_graph.getNeighbors(
          state.current_neighbor.originIntersectionId
        )
        const closestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(state.current_heading, neighbors);
        state.current_neighbor = closestNeighbor;
        const street = state.intersection_graph.getStreet(closestNeighbor.wayId);
        const nextIntersection = state.intersection_graph.getIntersection(closestNeighbor.nextIntersectionId);
        Utils.srAnnounce(
          document.getElementById("announcements-mount"),
          `<p>${street.label}, heading ${closestNeighbor.cardinalDirection}</p>
          <p>Next intersection: ${nextIntersection.description}, ${Utils.printDistance(closestNeighbor.distance)}</p>`
        );
      };
      state.intersection_graph.unnamedRoadsDisabled = !state.intersection_graph.unnamedRoadsDisabled;
      if (!state.intersection_graph.unnamedRoadsDisabled) {
        e.currentTarget.setAttribute("aria-label", "Disable unnamed roads");
        e.currentTarget.setAttribute("data-bs-title", "Disable unnamed roads");
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    getNeighbors();
      }
      else {
        e.currentTarget.setAttribute("aria-label", "Enable unnamed roads");
        e.currentTarget.setAttribute("data-bs-title", "Enable unnamed roads");
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    getNeighbors();
      }
    });

    document.getElementById("btn-previous").addEventListener("click", () => {
    if (state.location_history.length === 0) {
      Utils.srAnnounce(
        document.getElementById("announcements-mount"),
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

const neighbors = state.intersection_graph.getNeighbors(prevIntersection);
const closestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(
  state.current_heading, neighbors
);
      const nextIntersection = state.intersection_graph.getIntersection(closestNeighbor.nextIntersectionId);
      const street = state.intersection_graph.getStreet(closestNeighbor.wayId);

      Utils.srAnnounce(
        document.getElementById("status-text"),
        `Current intersection: ${currentIntersection.description}.`
      );
      announcements += relativeDirectionToString(closestNeighbor.angle, neighbors);
      announcements += `<p>On ${street.label}, heading ${closestNeighbor.cardinalDirection}</p>`;
      announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(nearestNeighbor.distance)} away.</p>`;

      state.lat = prevLat;
      state.lon = prevLon;
      state.current_neighbor = closestNeighbor;
      state.location_history.pop();
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-turn-left").addEventListener("click", () => {
      let announcements = "";

      // Select the neighbor reachable by the smallest counter-clockwise turn
      const neighbors = state.intersection_graph.getNeighbors(
        state.current_neighbor.originIntersectionId
      );
      const newNeighbor = state.intersection_graph.getLeftTurn(
        state.current_heading, neighbors
      );
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
      state.current_neighbor = newNeighbor;

      const street = state.intersection_graph.getStreet(newNeighbor.wayId);
      const nextIntersection = state.intersection_graph.getIntersection(newNeighbor.nextIntersectionId);
      announcements += `<p>${street.label}, heading ${newNeighbor.cardinalDirection}</p>`;
      announcements += `<p>Next intersection: ${nextIntersection.description}, ${Utils.printDistance(newNeighbor.distance)}</p>`;
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-go").addEventListener("click", async () => {
      let announcements = "";

      // Step 1: Advance to the previously announced next intersection
      const newCurrentIntersection = state.intersection_graph.getIntersection(
        state.current_neighbor.nextIntersectionId
      );
      const oldCurrentIntersection = state.intersection_graph.getIntersection(
        state.current_neighbor.originIntersectionId
      );
      const neighbors = state.intersection_graph.getNeighbors(
        newCurrentIntersection.id
      );
      const newNeighbor = state.intersection_graph.closestNeighborByAngularDiff(
        state.current_heading, neighbors
      );
      const newNextIntersection = state.intersection_graph.getIntersection(newNeighbor.nextIntersectionId);
      const street = state.intersection_graph.getStreet(newNeighbor.wayId);

      // Step 2: Calculate distance traveled and announce arrival
      const distance = Utils.calculateDistanceBetweenCordinates(
        oldCurrentIntersection.lat, oldCurrentIntersection.lon,
        newCurrentIntersection.lat, newCurrentIntersection.lon
      );
      Utils.srAnnounce(
        document.getElementById("status-text"),
        `Current intersection: ${newCurrentIntersection.description}.`
      );
      announcements += `<p>Moved ${Utils.printDistance(distance)} ${Utils.getCardinalDirection(state.current_heading)}</p>
      ${relativeDirectionToString(state.current_heading, state.intersection_graph.getNeighbors(newCurrentIntersection.id))}
        <p>On ${street.label}, heading ${newNeighbor.cardinalDirection}</p>`;

      // Record history before updating current intersection
      state.location_history.push({
        lat: state.lat,
        lon: state.lon,
        intersection: oldCurrentIntersection.id,
      });

      state.lat = newCurrentIntersection.lat;
      state.lon = newCurrentIntersection.lon;
      const tileKeyCoords = state.intersection_graph.latLonToTileXY(state.lat, state.lon);
      state.current_tile = `${tileKeyCoords.x}_${tileKeyCoords.y}`;
        const url = `?mode=road&coords=${state.lat},${state.lon}`;
        history.pushState({}, "", url);
      state.current_neighbor = newNeighbor;
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));

      // Step 3: Announce the upcoming intersection
      announcements += `<p>Next intersection: ${newNextIntersection.description}, ${Utils.printDistance(newNeighbor.distance)}</p>`;
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
      await updateTiles();
  });

  document.getElementById("btn-turn-right").addEventListener("click", () => {
      let announcements = "";

      // Select the neighbor reachable by the smallest clockwise turn
      const neighbors = state.intersection_graph.getNeighbors(
        state.current_neighbor.originIntersectionId
      );
      const newNeighbor = state.intersection_graph.getRightTurn(
        state.current_heading, neighbors
      );
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
      state.current_neighbor = newNeighbor;

      const street = state.intersection_graph.getStreet(newNeighbor.wayId);
      const nextIntersection = state.intersection_graph.getIntersection(newNeighbor.nextIntersectionId);
      announcements += `<p>${street.label}, heading ${newNeighbor.cardinalDirection}</p>`;
      announcements += `<p>Next intersection: ${nextIntersection.description}, ${Utils.printDistance(newNeighbor.distance)}</p>`;
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-turn-around").addEventListener("click", () => {
      const neighbors = state.intersection_graph.getNeighbors(
        state.current_neighbor.originIntersectionId
      );

      // Find all neighbors that share the current street ID (i.e., same road, both directions)
      const currentStreetKey = state.intersection_graph.getStreet(state.current_neighbor.wayId).key;
      const neighborsWithSameStreet = neighbors.filter(
        n => state.intersection_graph.getStreet(n.wayId).key === currentStreetKey
      );

      if (neighborsWithSameStreet.length === 1) {
        // Only one direction exists for this street — a U-turn is not possible
        Utils.srAnnounce(
          document.getElementById("announcements-mount"),
          `<p>Unable to turn around: current street only runs in one direction.</p>`
        );
        return;
      }

      // Find the neighbor on the same street with a different bearing (the reverse direction)
      const newNeighbor = neighborsWithSameStreet.find(
        n => currentStreetKey === state.intersection_graph.getStreet(n.wayId).key
          && state.current_neighbor.angle !== n.angle
      );

      // No neighbor found matching the above criteria
      if (!newNeighbor) {
        Utils.srAnnounce(
          document.getElementById("announcements-mount"),
          `<p>Unable to turn around.</p>`
        );
        return;
      }

      state.current_neighbor = newNeighbor;
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
      const street = state.intersection_graph.getStreet(newNeighbor.wayId);
      const nextIntersection = state.intersection_graph.getIntersection(newNeighbor.nextIntersectionId);
      Utils.srAnnounce(
        document.getElementById("announcements-mount"),
        `<p>${street.label}, heading ${newNeighbor.cardinalDirection}</p>
        <p>Next intersection: ${nextIntersection.description}, ${Utils.printDistance(newNeighbor.distance)}</p>`
      );
  });

  document.getElementById("btn-menu").addEventListener("click", (e) => {
    const menu = document.getElementById("menu");
    const isHidden = (menu.hidden === true);
    e.currentTarget.setAttribute("aria-expanded", String(isHidden));
    menu.hidden = !isHidden;
  });
};
