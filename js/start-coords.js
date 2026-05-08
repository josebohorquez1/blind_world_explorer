import { initStartScreen } from "./Start.js";
import { switchApplicationView } from "./loader.js";
import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";
import { initExploreMode } from "./mode-explore.js";

export const coordsScreenEvents = () => {
    lucide.createIcons();
    for (const el of document.body.children) {
        if (el.id !== "app-view") el.inert = true;
    }
    document.getElementsByTagName("input")[0].focus();
    document.getElementById("back").addEventListener("click", () => {
        for (const ele of document.body.children) ele.inert = false;
        switchApplicationView(
            "pages/start.html",
            document.getElementById("app-mount"),
            async () => {
                initStartScreen();
                await Utils.sleep(100);
                document.getElementsByTagName("button")[0].focus();
            }
        );
    });


    //For lat and lon inputs
    const initCoordsInputEvents = (latInput, lonInput) => {
        const LAT_PATTERN = /^-?\d{0,2}(\.\d*)?$/;
        const LON_PATTERN = /^-?\d{0,3}(\.\d*)?$/;
        function validate(input, pattern) {
            if (!pattern.test(input.value)) input.value = input.value.slice(0, -1);
        }
        latInput.addEventListener("input", () => validate(latInput, LAT_PATTERN));
        lonInput.addEventListener("input", () => validate(lonInput, LON_PATTERN));
        latInput.addEventListener("keydown", (e) => {
            if (e.key === ",") {
                e.preventDefault();
                lonInput.focus();
            }
        });
        latInput.addEventListener("paste", (e) => {
            const text = e.clipboardData.getData("text").trim();
            if (text.includes(",")) {
                e.preventDefault();
                const [lat, lon] = text.split(",");
                if (lat) latInput.value = lat;
                if (lon) lonInput.value = lon;
                lonInput.focus();
            }
        });
        latInput.addEventListener("blur", () => {
            const errorBox = document.getElementById("lat-error");
            const goButton = document.getElementById("submit");
            const lat = parseFloat(latInput.value);
            if (isNaN(lat)) {
                errorBox.textContent = "Error: lattitude must be a number.";
                goButton.disabled = true;
                return;
            }
            if (lat <= -90 || lat >= 90) {
                errorBox.textContent = "Error: lattitude must be a decimal number between -90 and 90 degrees.";
                goButton.disabled = true;
                return;
            }
            errorBox.textContent = "";
            if (!document.getElementById("lon-error").textContent) goButton.disabled = false;
        });
        lonInput.addEventListener("blur", () => {
            const errorBox = document.getElementById("lon-error");
            const goButton = document.getElementById("submit");
            const lon = parseFloat(lonInput.value);
            if (isNaN(lon)) {
                errorBox.textContent = "Error: longitude must be a number.";
                goButton.disabled = true;
                return;
            }
            if (lon <= -180 || lon >= 180) {
                errorBox.textContent = "Error: longitude must be a decimal number between -180 and 180 degrees.";
                goButton.disabled = true;
                return;
            }
            errorBox.textContent = "";
            if (!document.getElementById("lat-error").textContent) goButton.disabled = false;
        });
    };
    initCoordsInputEvents(
        document.getElementById("lat-input"),
        document.getElementById("lon-input")
    );
    document.getElementById("submit").addEventListener("click", async () => {
        state.lat = parseFloat(document.getElementById("lat-input").value).toFixed(8);
        state.lon = parseFloat(document.getElementById("lon-input").value).toFixed(8);
        switchApplicationView(
            "pages/mode-explore.html",
            document.getElementById("app-mount"),
            initExploreMode
        );
    });
};
