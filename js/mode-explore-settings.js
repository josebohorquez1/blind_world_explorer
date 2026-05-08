import * as Utils from "./UtilFunctions.js";
import { switchApplicationView } from "./loader.js";
import { initExploreMode } from "./mode-explore.js";
import { state } from "./state.js";

export const initExploreModeSettings = () => {
    lucide.createIcons();
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));
    for (const el of document.body.children) {
        if (el.id !== "app-view") el.inert = true;
    }
    Utils.sleep(100).then(() => 
    document.querySelector("#freeExploreSettingsModal input").focus());

    const sanitizeDegreeInputs = (input) => {
        input.value = input.value.replace(/[.-]/g, "");
        if (parseFloat(input.value) >= 360) input.value = input.value.slice(0, -1);
    };

    document.getElementById("setting-direction").addEventListener("input", (e) => sanitizeDegreeInputs(e.currentTarget));

    document.getElementById("setting-rotation-increment").addEventListener("input", (e) => sanitizeDegreeInputs(e.currentTarget));

    document.getElementById("cancel").addEventListener("click", () => {
        for (const el of document.body.children) el.inert = false;
        switchApplicationView(
            "pages/mode-explore.html",
            document.getElementById("app-mount"),
            initExploreMode
        );
    });

    document.getElementById("apply").addEventListener("click", () => {
        let movingDistance = parseFloat(document.getElementById("setting-moving-distance").value);
        const distanceUnit = document.getElementById("setting-moving-unit").value;
        const directionInDegrees = parseFloat(document.getElementById("setting-direction").value);
        const rotationIncrement = document.getElementById("setting-rotation-increment");
        if (distanceUnit === "feet") movingDistance *= 0.3048;
        if (distanceUnit === "kilometers") movingDistance *= 1000;
        if (distanceUnit === "miles") movingDistance *= 1609.34;
        state.current_moving_distance = movingDistance;
        state.current_heading = Math.round(directionInDegrees);
        state.current_rotation_increment = Math.round(rotationIncrement);
        for (const el of document.body.children) el.inert = false;
        switchApplicationView(
            "pages/mode-explore.html",
            document.getElementById("app-mount"),
            initExploreMode
        );
    });
}
