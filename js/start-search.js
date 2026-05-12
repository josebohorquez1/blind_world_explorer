//File containing the search functionality

//Import state variables
import { switchApplicationView } from "./loader.js";
import { initExploreMode } from "./mode-explore.js";
import { initStartScreen } from "./Start.js";
import { state } from "./state.js";
//Import utility functions
import * as Utils from "./UtilFunctions.js";

//Function to run the search and retrieve result sorted by distance
const search = async (query) => {
    if (!query || !query.trim()) return [];
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "20");
    const response = await fetch(url.toString(), {
        headers: {
            "Accept": "application/json"
        }
    });
    if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
        return [];
    }
    const res = await response.json();
    return res;
}

//Function wrapper to hold the search functionality for export
export const initSearchEvents = async () => {
    lucide.createIcons();

    Array.from(document.body.children).forEach(el => {
        if (el.id !== "app-view") el.inert = true;
    });
    document.getElementById("search-input").focus();

    document.getElementById("search-back").addEventListener("click", async () => {
        Array.from(document.body.children).forEach(el => el.inert = false);
        await switchApplicationView(
            "pages/start.html",
            document.getElementById("app-mount"),
            async () => {
                initStartScreen();
                document.getElementsByTagName("button")[0].focus();
            }
        );
    });

    document.getElementById("search-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const input = document.getElementById("search-input");
        const container = document.getElementById("search-results");
        container.innerHTML = "";
        if (!input.value) return;
        const results = await search(input.value.trim());
        if (results.length === 0) container.textContent = "No results found. Refine your search and try again.";
        for (const place of results) {
            const btn = document.createElement("button");
            btn.className = "btn btn-outline-secondary text-start";
            btn.textContent = place.display_name;
            btn.addEventListener("click", async () => {
                Array.from(document.body.children).forEach(el => el.inert = false);
                state.lat = parseFloat(place.lat);
                state.lon = parseFloat(place.lon);
                container.innerHTML = "";
                switchApplicationView(
                    "pages/mode-explore.html",
                    document.getElementById("app-mount"),
                    initExploreMode
                );
            });
            container.appendChild(btn);
        }
    });
}
