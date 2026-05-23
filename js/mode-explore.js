import * as ExploreUtils from "./mode-explore-utils.js";
import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";
import { initExplorerMenu } from "./mode-explore-menu.js";
import { initkeyboardEvents } from "./mode-explore-keyboard.js";

export const initExploreMode = async () => {
    const statusMount = document.getElementById("status-text");
    const announcementsMount = document.getElementById("announcements-mount");
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    await Utils.sleep(100);
    document.querySelector("#turn-buttons button").focus();
    const url = `?mode=explore&coords=${state.lat},${state.lon}`;
    const currentLocationDescription = await ExploreUtils.reportCurrentLocation(state.lat, state.lon);
    Utils.srAnnounce(statusMount, `${currentLocationDescription}`);
    Utils.srAnnounce(announcementsMount, `<p>Heading ${state.current_heading} degrees ${Utils.getCardinalDirection(state.current_heading)}</p>`);
    history.pushState({}, "", url);
    initExplorerMenu();
    initkeyboardEvents();

    document.getElementById("nav-new-location").addEventListener("click", ExploreUtils.exploreNewLocation);

    document.getElementById("nav-road-mode").addEventListener("click", ExploreUtils.switchToRoadMode);

    document.getElementById("nav-settings").addEventListener("click", ExploreUtils.openSettings);

    document.getElementById("btn-previous").addEventListener("click", ExploreUtils.movePrevious);
    
    document.getElementById("btn-turn-left").addEventListener("click", ExploreUtils.turnLeft);

    document.getElementById("btn-go").addEventListener("click", ExploreUtils.moveForward);

    document.getElementById("btn-turn-right").addEventListener("click", ExploreUtils.turnRight);

    document.getElementById("btn-turn-around").addEventListener("click", ExploreUtils.turnAround);

    document.getElementById("zoom-in").addEventListener("click", ExploreUtils.decreaseDistance);

    document.getElementById("zoom-out").addEventListener("click", ExploreUtils.increaseDistance);

  document.getElementById("btn-menu").addEventListener("click", ExploreUtils.toggleMenu);
};
