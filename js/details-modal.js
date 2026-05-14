import { switchApplicationView } from "./loader.js";
import { initExploreMode } from "./mode-explore.js";
import { initRoadMode } from "./mode-road.js";

export const initDetailsModal = () => {
    lucide.createIcons();
    for (const el of document.body.children) {
        if (el.id !== "app-view") el.inert = true;

        document.getElementById("details-close").addEventListener("click", () => {
            for (const el of document.body.children) el.inert = false;
        const params = new URLSearchParams(location.search);
        const mode = params.get("mode");
            if (mode === "road") switchApplicationView(
                "pages/mode-road.html",
                document.getElementById("app-mount"),
                initRoadMode
            );
            else switchApplicationView(
                "pages/mode-explore.html",
                document.getElementById("app-mount"),
                initExploreMode
            );
        });
    }
}
