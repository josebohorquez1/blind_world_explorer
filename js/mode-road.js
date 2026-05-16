import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { state } from "./state.js";
import { initStartScreen } from "./Start.js";
import { initRoadMenu } from "./mode-road-menu.js";
import { Neighbor } from "./map-neighbor.js";
import * as roadUtils from "./mode-road-utils.js";

export const initRoadMode = async () => {
  const statusMount = document.getElementById("status-text");
  const announcementsMount = document.getElementById("announcements-mount");
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    await Utils.sleep(100);
    for (const btn of document.getElementsByTagName("button")) btn.disabled = true;
    await roadUtils.initData(statusMount, announcementsMount);
    for (const btn of document.getElementsByTagName("button")) btn.disabled = false;
    document.querySelector("#turn-buttons button").focus();
    initRoadMenu();

    document.getElementById("nav-explore-mode").addEventListener("click", () => {
      roadUtils.returnToExploreMode();
    });

    document.getElementById("nav-new-location").addEventListener("click", () => {
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
const alignAnnouncement = roadUtils.updateAlignment(state.current_heading,state.current_intersection, "", true);
Utils.srAnnounce(announcementsMount, `${alignAnnouncement}`);
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
      Utils.srAnnounce(announcementsMount
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

const alignAnnouncement = roadUtils.updateAlignment(state.current_heading, currentIntersection.id, "", true);
      Utils.srAnnounce(statusMount, `Current intersection: ${currentIntersection.description}`);
      announcements += `${alignAnnouncement}`;

      state.lat = prevLat;
      state.lon = prevLon;
      state.current_intersection = prevIntersection;
      state.location_history.pop();
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-turn-left").addEventListener("click", () => {
      // Select the neighbor reachable by the smallest counter-clockwise turn
      const alignAnnouncement = roadUtils.updateAlignment(state.current_heading, state.current_intersection, "left", false);
      Utils.srAnnounce(announcementsMount, `<p>${alignAnnouncement}</p>`);
  });

  document.getElementById("btn-go").addEventListener("click", async () => {
      let announcements = "";

      // Step 1: Advance to the previously announced next intersection
      const oldCurrentIntersection = state.intersection_graph.getIntersection(state.current_intersection);
      const newIntersectionAnnouncements = roadUtils.updateIntersection(state.current_heading, state.current_intersection, true);
      const alignAnnouncement = roadUtils.updateAlignment(state.current_heading, state.current_intersection, "", true);
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
      await roadUtils.updateTiles();
  });

  document.getElementById("btn-turn-right").addEventListener("click", () => {
      // Select the neighbor reachable by the smallest clockwise turn
      const alignAnnouncement = roadUtils.updateAlignment(state.current_heading, state.current_intersection, "right", false);
      Utils.srAnnounce(announcementsMount, `${alignAnnouncement}`);
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
