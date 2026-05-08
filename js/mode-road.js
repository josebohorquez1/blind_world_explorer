import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { state } from "./state.js";
import { initStartScreen } from "./Start.js";
import { initExploreMode } from "./mode-explore.js";

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
    const announcementsElement = document.getElementById("announcements-mount");
    const status = document.getElementById("status-text");
      let announcements = "";

      const fetchResponse = await state.intersection_graph.loadFromCoords(state.lat, state.lon);
      if (fetchResponse === -1) {
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
      const closestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(
        state.current_heading,
        closestIntersection
      );
      state.current_heading = Utils.updateHeading(Math.round(closestNeighbor.angle));
      announcements += `<p>Heading ${closestNeighbor.cardinal} on ${closestNeighbor.street.label}</p>`;

      // Step 3: Set state and announce the next intersection along the aligned street
      state.current_intersection = closestIntersection;
      state.current_road = closestNeighbor;
      state.lat = closestIntersection.lat;
      state.lon = closestIntersection.lon;
    const url = `?mode=road&coords=${state.lat},${state.lon}`;
    history.pushState({}, "", url);
    state.next_intersection = closestNeighbor.intersection;
      announcements += `<p>Next intersection: ${closestNeighbor.intersection.description} ${Utils.printDistance(closestNeighbor.distance)} away.</p>`;

      Utils.srAnnounce(announcementsElement, announcements);
};

export const initRoadMode = async () => {
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    Utils.sleep(100).then(() => 
    document.querySelector("#turn-buttons button").focus());
    await initData();

    document.getElementById("nav-explore-mode").addEventListener("click", () => {
      returnToExploreMode();
    });

    document.getElementById("nav-new-location").addEventListener("click", () => {
      const url = location.origin + location.pathname;
      history.replaceState({}, "", url);
      switchApplicationView(
        "pages/start.html",
        document.getElementById("app-mount"),
        initStartScreen
      );
    });
    
    document.getElementById("nav-refresh-road").addEventListener("click", () => {
      initData();
    });

    document.getElementById("nav-toggle-unnamed").addEventListener("click", (e) => {
      state.intersection_graph.unnamedRoadsDisabled = !state.intersection_graph.unnamedRoadsDisabled;
      if (!state.intersection_graph.unnamedRoadsDisabled) {
        e.currentTarget.setAttribute("aria-label", "Disable unnamed roads");
        e.currentTarget.setAttribute("data-bs-title", "Disable unnamed roads");
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
      }
      else {
        e.currentTarget.setAttribute("aria-label", "Enable unnamed roads");
        e.currentTarget.setAttribute("data-bs-title", "Enable unnamed roads");
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
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

    const lastPoint = state.location_history[state.location_history.length - 1];
    const currentLat = state.lat;
    const currentLon = state.lon;
    const { lat: prevLat, lon: prevLon, intersection: prevIntersection } = lastPoint;
      if (!prevIntersection) {
        // History entry came from explorer mode — snap to the nearest intersection instead
        announcements += `<p>The previous point does not contain intersection data. Placing you at the nearest intersection.</p>`;
        const nearestIntersection = state.intersection_graph.getNearestIntersection(prevLat, prevLon);
        const nearestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(
          Math.round(state.current_heading),
          nearestIntersection
        );
        const nextIntersection = nearestNeighbor.intersection;

        announcements += `<p>Current intersection: ${nearestIntersection.description}</p>`;
        announcements += `<p>Heading ${nearestNeighbor.cardinal} on ${nearestNeighbor.street.label}.</p>`;
        announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(nearestNeighbor.distance)} away.</p>`;

        state.lat = prevLat;
        state.lon = prevLon;
        state.current_intersection = nearestIntersection;
        state.next_intersection = nextIntersection;
        state.location_history.pop();
        Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
        return;
      }

      // Restore to the previously visited named intersection
      const nearestNeighbor = state.intersection_graph.closestNeighborByAngularDiff(
        Math.round(state.current_heading),
        prevIntersection
      );
      const nextIntersection = nearestNeighbor.intersection;

      announcements += `<p>Returning to previously visited intersection.</p>
        <p>Current intersection: ${prevIntersection.description}.</p>`;
      announcements += `<p>Heading ${nearestNeighbor.cardinal} on ${nearestNeighbor.street.label}.</p>`;
      announcements += `<p>Next intersection: ${nextIntersection.description} ${Utils.printDistance(nearestNeighbor.distance)} away.</p>`;

      state.lat = prevLat;
      state.lon = prevLon;
      state.current_intersection = prevIntersection;
      state.next_intersection = nextIntersection;
      state.location_history.pop();
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-turn-left").addEventListener("click", () => {
      let announcements = "";

      // Select the neighbor reachable by the smallest counter-clockwise turn
      const newNeighbor = state.intersection_graph.getLeftTurn(
        state.current_intersection.id,
        state.current_heading
      );
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
      state.current_road = newNeighbor;
      state.next_intersection = newNeighbor.intersection;

      announcements += `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>`;
      announcements += `<p>Next intersection: ${newNeighbor.intersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`;
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-go").addEventListener("click", () => {
      let announcements = "";

      // Step 1: Advance to the previously announced next intersection
      const newCurrentIntersection = state.next_intersection;
      const newNeighbor = state.intersection_graph.closestNeighborByAngularDiff(
        Math.round(state.current_heading),
        newCurrentIntersection
      );
      const newNextIntersection = newNeighbor.intersection;

      // Step 2: Calculate distance traveled and announce arrival
      const distance = Utils.calculateDistanceBetweenCordinates(
        state.current_intersection.lat, state.current_intersection.lon,
        newCurrentIntersection.lat, newCurrentIntersection.lon
      );
      Utils.srAnnounce(
        document.getElementById("status-text"),
        `Current intersection: ${newCurrentIntersection.description}.`
      );
      announcements += `<p>Moved ${Utils.printDistance(distance)} ${Utils.getCardinalDirection(state.current_heading)}</p>
        <p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}.</p>`;

      // Record history before updating current intersection
      state.location_history.push({
        lat: state.lat,
        lon: state.lon,
        intersection: state.current_intersection,
      });

      state.lat = newCurrentIntersection.lat;
      state.lon = newCurrentIntersection.lon;
        const url = `?mode=road&coords=${state.lat},${state.lon}`;
        history.pushState({}, "", url);
      state.current_intersection = newCurrentIntersection;
      state.next_intersection = newNextIntersection;
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));

      // Step 3: Announce the upcoming intersection
      announcements += `<p>Next intersection: ${newNextIntersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`;
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-turn-right").addEventListener("click", () => {
      let announcements = "";

      // Select the neighbor reachable by the smallest clockwise turn
      const newNeighbor = state.intersection_graph.getRightTurn(
        state.current_intersection.id,
        state.current_heading
      );
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
      state.current_road = newNeighbor;
      state.next_intersection = newNeighbor.intersection;

      announcements += `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>`;
      announcements += `<p>Next intersection: ${newNeighbor.intersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`;
      Utils.srAnnounce(document.getElementById("announcements-mount"), announcements);
  });

  document.getElementById("btn-turn-around").addEventListener("click", () => {
      const neighbors = state.intersection_graph.getNeighbors(state.current_intersection.id);

      // Find all neighbors that share the current street label (i.e., same road, both directions)
      const neighborsWithSameStreet = neighbors.filter(
        n => n.street.label === state.current_road.street.label
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
        n => state.current_road.street.label === n.street.label
          && state.current_road.angle !== n.angle
      );

      // No neighbor found matching the above criteria
      if (!newNeighbor) {
        Utils.srAnnounce(
          document.getElementById("announcements-mount"),
          `<p>Unable to turn around.</p>`
        );
        return;
      }

      state.current_road = newNeighbor;
      state.next_intersection = newNeighbor.intersection;
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));
      Utils.srAnnounce(
        document.getElementById("announcements-mount"),
        `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>
        <p>Next intersection: ${newNeighbor.intersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`
      );
  });
};
