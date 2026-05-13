import { switchApplicationView } from "./loader.js";
import { initRoadMode } from "./mode-road.js";

export const initDetailsModal = () => {
    lucide.createIcons();
    for (const el of document.body.children) {
        if (el.id !== "app-view") el.inert = true;

        document.getElementById("details-close").addEventListener("click", async () => {
            for (const el of document.body.children) el.inert = false;
            await switchApplicationView(
                "pages/mode-road.html",
                document.getElementById("app-mount"),
                initRoadMode
            );
        });
    }
}
