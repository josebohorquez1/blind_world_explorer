//File containing the search functionality

//Import state variables
import { state } from "./state.js";
//Import utility functions
import * as Utils from "./UtilFunctions.js";

//Function to run the search and retrieve result sorted by distance
const runSearch = async (query) => {
if (!query) return null;
const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&lat=${state.lat}&lon=${state.lon}`;
try {
    const res = await fetch(url, {headers: {"Accept-Language": "en"}});
    const data = await res.json();
    if (!data) return 0;
    const results_by_distance = data.map(point => {
        const d = Utils.calculateDistanceBetweenCordinates(state.lat, state.lon, parseFloat(point.lat), parseFloat(point.lon));
        return {...point, distance: d};
    }).sort((a, b) => a.distance - b.distance);
    return results_by_distance;
}
catch (err) {
    return -1;
}
};

//Function wrapper to hold the search functionality for export
export const initSearchEvent = () => {
    //Search button and search results buttons
    let search_timer;
    document.querySelector("#searchBox").addEventListener("input", async (e) => {
        const query = document.querySelector("#searchBox").value.trim();
        const results_area = document.querySelector("#searchResults");
        clearTimeout(search_timer);
        if (query.length < 3) return;
        search_timer = setTimeout( async () => {
        const data = await runSearch(query);
        if (data == 0) {
            results_area.innerHTML = `<p>No Results</p>`;
            return;
        }
        if (data == -1) {
            results_area.innerHTML = `<p>Error fetching results.</p>`;
            return;
        }
        if (data == null) {
            results_area.innerHTML = `<p>No Results. Refine your search or fix your spelling.</p>`;
            return;
        }
        let html = `<ul>`;
        data.forEach(point => {
            html += `<li><button data-lat="${point.lat}" data-lon=${point.lon}">${point.display_name}, ${Utils.printDistance(point.distance)} away</button></li>`;
        });
        html+= `</ul>`;
        results_area.innerHTML = html;
            document.querySelectorAll("#searchResults ul li button").forEach(button => {
                button.addEventListener("click", () => {
                    state.lat= parseFloat(button.dataset.lat);
                    state.lon= parseFloat(button.dataset.lon);
                    Utils.updateStatus(state.lat, state.lon);
                    results_area.innerHTML = "";
                    query = "";
                });
            });
                }, 500);
    });
};
