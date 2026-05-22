import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { state } from "./state.js";
import { initStartScreen } from "./Start.js";
import { initRoadMenu } from "./mode-road-menu.js";
import { Neighbor } from "./map-neighbor.js";
import * as roadUtils from "./mode-road-utils.js";
import { initkeyboardEvents } from "./mode-road-keyboard.js";

export const initRoadMode = async () => {
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    await Utils.sleep(100);
    for (const btn of document.getElementsByTagName("button")) btn.disabled = true;
    await roadUtils.initData();
    for (const btn of document.getElementsByTagName("button")) btn.disabled = false;
    document.querySelector("#turn-buttons button").focus();
    initRoadMenu();
    initkeyboardEvents();

    document.getElementById("nav-explore-mode").addEventListener("click", () => {
      roadUtils.returnToExploreMode();
    });

    document.getElementById("nav-new-location").addEventListener("click", roadUtils.switchToExploreMode);
    
    document.getElementById("nav-refresh-road").addEventListener("click", roadUtils.refreshRoadData);

    document.getElementById("nav-toggle-unnamed").addEventListener("click", roadUtils.toggleUnnamedRoads);

    document.getElementById("btn-previous").addEventListener("click", roadUtils.movePrevious);

  document.getElementById("btn-turn-left").addEventListener("click", roadUtils.turnLeft);

  document.getElementById("btn-go").addEventListener("click", roadUtils.moveForward);

  document.getElementById("btn-turn-right").addEventListener("click", roadUtils.turnRight);

  document.getElementById("btn-turn-around").addEventListener("click", roadUtils.turnAround);

  document.getElementById("btn-menu").addEventListener("click", roadUtils.toggleMenu);
};
