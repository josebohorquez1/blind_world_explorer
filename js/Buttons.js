/**
 * Buttons.js
 *
 * Registers all button event listeners for the intersection explorer.
 * Handles two modes of navigation:
 *   - Explorer mode: free movement in any direction by bearing and distance
 *   - Road mode: snapped navigation along the street graph (intersection to intersection)
 *
 * All user-facing feedback is announced via the #announcements live region
 * for screen reader compatibility.
 *
 * Exports:
 *   initButtons()  -- call once on page load to attach all listeners
 */

import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";
import * as Map from "./Map.js";

/**
 * Attaches click event listeners to all navigation and control buttons.
 *
 * Buttons handled:
 *   changeModeButton    -- toggles between explorer mode and road mode
 *   turnLeft            -- rotates heading left (explorer) or selects left-turn neighbor (road)
 *   turnRight           -- rotates heading right (explorer) or selects right-turn neighbor (road)
 *   turnAround          -- reverses heading (explorer) or flips direction on current street (road)
 *   go                  -- moves forward one step (explorer) or advances to next intersection (road)
 *   returnPrevious      -- returns to the last position in location history
 *   zoomIn / zoomOut    -- halves or doubles the explorer movement distance
 */
export const initButtons = () => {

  // ── Change Mode ────────────────────────────────────────────────────────────

  document.getElementById("changeModeButton").addEventListener("click", async (e) => {

    /**
     * Reverts UI and state back to explorer mode.
     * Re-enables buttons that were disabled during road mode and strips
     * their ": Disabled during road mode." suffix.
     */
    const returnToExploreMode = async () => {
      e.target.textContent = "Change to Road Mode";
      document.querySelectorAll("#openMovementSettingsButton, #zoomButtons button").forEach(el => {
        el.disabled = false;
        // Strip the appended disability notice added when entering road mode
        const colonPos = el.textContent.indexOf(":");
        el.textContent = el.textContent.substring(0, colonPos);
      });
      state.is_road_mode = false;
    };

    state.is_road_mode = !state.is_road_mode;

    if (state.is_road_mode) {
      e.target.textContent = "Change to Explorer Mode";
      document.querySelectorAll("#openMovementSettingsButton, #zoomButtons button").forEach(el => {
        el.disabled = true;
        el.textContent += `: Disabled during road mode.`;
      });

      let announcements = "";

      const fetchResponse = await state.intersection_graph.loadFromCoords(state.lat, state.lon);
      if (fetchResponse === -1) {
        announcements += `<p>Unable to load intersection data. Returning to explorer mode. Click the "change to road mode" button to try again.</p>`;
        Utils.srAnnounce(document.getElementById("announcements"), announcements);
        returnToExploreMode();
        return;
      }

      announcements += `<p>Changed mode to road mode. You will now be able to navigate by road.</p>`;

      // Step 1: Snap to the nearest named intersection
      const closestIntersection = state.intersection_graph.getNearestIntersection(state.lat, state.lon);
      if (!closestIntersection) {
        announcements += `<p>Unable to be placed on a road. Returning to free explore mode.</p>`;
        announcements += `<p>${await Utils.updateStatus(state.lat, state.lon)}</p>`;
        Utils.srAnnounce(document.querySelector("#announcements"), announcements);
        returnToExploreMode();
        return;
      }
      announcements += `<p>Current intersection: ${closestIntersection.description}</p>`;

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
      state.next_intersection = closestNeighbor.intersection;
      announcements += `<p>Next intersection: ${closestNeighbor.intersection.description} ${Utils.printDistance(closestNeighbor.distance)} away.</p>`;

      Utils.srAnnounce(document.getElementById("announcements"), announcements);

    } else {
      // Leaving road mode: announce current free-explore position and restore UI
      Utils.srAnnounce(
        document.getElementById("announcements"),
        `<p>${await Utils.updateStatus(state.lat, state.lon)}</p>`
      );
      returnToExploreMode();
    }
  });

  // ── Turn Left ──────────────────────────────────────────────────────────────

  document.querySelector("#turnLeft").addEventListener("click", async () => {
    if (!state.is_road_mode) {
      state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
      Utils.srAnnounce(
        document.getElementById("announcements"),
        `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>`
      );
    } else {
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
      Utils.srAnnounce(document.getElementById("announcements"), announcements);
    }
  });

  // ── Turn Right ─────────────────────────────────────────────────────────────

  document.querySelector("#turnRight").addEventListener("click", async () => {
    if (!state.is_road_mode) {
      state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
      Utils.srAnnounce(
        document.getElementById("announcements"),
        `<p>Heading ${state.current_heading} degrees ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>`
      );
    } else {
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
      Utils.srAnnounce(document.getElementById("announcements"), announcements);
    }
  });

  // ── Turn Around ────────────────────────────────────────────────────────────

  document.querySelector("#turnAround").addEventListener("click", (e) => {
    if (!state.is_road_mode) {
      state.current_heading = Utils.updateHeading(state.current_heading + 180);
      Utils.srAnnounce(
        document.getElementById("announcements"),
        `<p>Heading ${state.current_heading} degrees ${state.directions[(Math.round(state.current_heading) / 45) % 8]}.</p>`
      );
    } else {
      const neighbors = state.intersection_graph.getNeighbors(state.current_intersection.id);

      // Find all neighbors that share the current street label (i.e., same road, both directions)
      const neighborsWithSameStreet = neighbors.filter(
        n => n.street.label === state.current_road.street.label
      );

      if (neighborsWithSameStreet.length === 1) {
        // Only one direction exists for this street — a U-turn is not possible
        Utils.srAnnounce(
          document.getElementById("announcements"),
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
          document.getElementById("announcements"),
          `<p>Unable to turn around.</p>`
        );
        return;
      }

      state.current_road = newNeighbor;
      Utils.srAnnounce(
        document.getElementById("announcements"),
        `<p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}</p>
        <p>Next intersection: ${newNeighbor.intersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`
      );
    }
  });

  // ── Go (Move Forward) ──────────────────────────────────────────────────────

  document.querySelector("#go").addEventListener("click", async () => {
    if (!state.is_road_mode) {
      state.location_history.push({ lat: state.lat, lon: state.lon, intersection: null });

      const { lat: new_lat, lon: new_lon } = Utils.move(
        state.lat, state.lon,
        state.current_moving_distance,
        state.current_heading
      );
      state.lat = new_lat;
      state.lon = new_lon;

      const description = await Utils.updateStatus(state.lat, state.lon);
      Utils.srAnnounce(
        document.querySelector("#announcements"),
        `<p>${description}</p>
        <p>Moved ${Utils.printDistance(state.current_moving_distance)} ${state.directions[Math.round(state.current_heading / 45) % 8]}.</p>`
      );

    } else {
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
      announcements += `<p>Moved ${Utils.printDistance(distance)} ${state.directions[Math.round(state.current_heading / 45) % 8]}</p>
        <p>Current intersection: ${newCurrentIntersection.description}.</p>
        <p>Heading ${newNeighbor.cardinal} on ${newNeighbor.street.label}.</p>`;

      // Record history before updating current intersection
      state.location_history.push({
        lat: state.lat,
        lon: state.lon,
        intersection: state.current_intersection,
      });

      state.lat = newCurrentIntersection.lat;
      state.lon = newCurrentIntersection.lon;
      state.current_intersection = newCurrentIntersection;
      state.next_intersection = newNextIntersection;
      state.current_heading = Utils.updateHeading(Math.round(newNeighbor.angle));

      // Step 3: Announce the upcoming intersection
      announcements += `<p>Next intersection: ${newNextIntersection.description} ${Utils.printDistance(newNeighbor.distance)} away.</p>`;
      Utils.srAnnounce(document.getElementById("announcements"), announcements);
    }
  });

  // ── Return to Previous ─────────────────────────────────────────────────────

  document.getElementById("returnPrevious").addEventListener("click", async () => {
    if (state.location_history.length === 0) {
      Utils.srAnnounce(
        document.querySelector("#announcements"),
        `<p>There are no previous points. Navigate to an intersection in road mode or explore freely to create previous points.</p>`
      );
      return;
    }

    const lastPoint = state.location_history[state.location_history.length - 1];
    const currentLat = state.lat;
    const currentLon = state.lon;
    const { lat: prevLat, lon: prevLon, intersection: prevIntersection } = lastPoint;

    let announcements = "";

    if (state.is_road_mode) {
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
        Utils.srAnnounce(document.querySelector("#announcements"), announcements);
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
      Utils.srAnnounce(document.querySelector("#announcements"), announcements);

    } else {
      // Explorer mode: restore raw coordinates and describe displacement from current position
      state.lat = prevLat;
      state.lon = prevLon;

      const distanceMoved = Utils.calculateDistanceBetweenCordinates(currentLat, currentLon, prevLat, prevLon);
      const bearingToPrev = Utils.getBearingAndDirection(currentLat, currentLon, prevLat, prevLon);

      announcements += `<p>${await Utils.updateStatus(prevLat, prevLon)}.</p>`;
      announcements += `<p>Moved ${Utils.printDistance(distanceMoved)} ${bearingToPrev.cardinal}.</p>`;

      state.location_history.pop();
      Utils.srAnnounce(document.querySelector("#announcements"), announcements);
    }
  });

  // ── Zoom In / Zoom Out ─────────────────────────────────────────────────────

  document.getElementById("zoomIn").addEventListener("click", () => {
    // Halve movement distance, floor at 1 meter
    state.current_moving_distance = Math.max(1, state.current_moving_distance / 2);
    Utils.srAnnounce(
      document.querySelector("#announcements"),
      `Zoomed in to ${Utils.printDistance(state.current_moving_distance)}`
    );
  });

  document.getElementById("zoomOut").addEventListener("click", () => {
    // Double movement distance, cap at ~1000 miles (1,609,000 meters)
    state.current_moving_distance = Math.min(state.current_moving_distance * 2, 1609000);
    Utils.srAnnounce(
      document.querySelector("#announcements"),
      `Zoomed out to ${Utils.printDistance(state.current_moving_distance)}`
    );
  });

};
