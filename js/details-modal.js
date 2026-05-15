import { switchApplicationView } from "./loader.js";
import { initExploreMode } from "./mode-explore.js";
import { initRoadMode } from "./mode-road.js";

export const initDetailsModal = () => {

    const close = document.getElementById("modal-close");

    close.addEventListener("click", () => {
        const overlay = close.closest("div").parentElement;
        overlay.remove();
        document.getElementById("menu").hidden = true;
        document.getElementById("btn-menu")
        .setAttribute("aria-expanded", "false");
    });

};
