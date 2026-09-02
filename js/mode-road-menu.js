import { initDetailsModal } from "./details-modal.js";
import { state } from "./state.js";
import * as Utils from "./UtilFunctions.js";
import { showDialog } from "./dialog.js";
import { clearTilesFromCache } from "./map-cache.js";

const injectToModal = async (content) => {

    let modalEl = document.getElementById("detailsModal");

    // If modal is not yet in the DOM, load it
    if (!modalEl) {

        const mount = document.getElementById("app-mount");

        const res = await fetch("pages/details-modal.html");

        if (!res.ok) {
            console.error("Failed to load modal");
            return;
        }

        const html = await res.text();

        mount.insertAdjacentHTML("beforeend", html);

        modalEl = document.getElementById("detailsModal");

        // initialize modal behavior
        initDetailsModal();
    }

    const modalContent = modalEl.querySelector("#modal-content");

    if (!modalContent) {
        console.error("Modal content container missing");
        return;
    }

    modalContent.innerHTML = content;

    // show modal using Bootstrap
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

    const handleArrows = (event) => {
    const menuButton = document.getElementById("btn-menu");
    const menu = document.getElementById("menu");
    const active = document.activeElement;
        const items = Array.from(menu.getElementsByTagName("button"));
        let index = items.indexOf(document.activeElement);
        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (active === menuButton || index === -1) {
                items[0].focus();
                return;
            }
            const next = (index + 1) % items.length;
            items[next].focus();
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (active === menuButton || index === -1) {
                items[items.length - 1].focus();
                return;
            }
            const prev = (index - 1 + items.length) % items.length;
            items[prev].focus();
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closeMenu(menuButton, menu);
        }
    };

const makeTable = (obj) => {
    let table = `
    <table class="table table-striped table-sm">
        <thead>
            <tr>
                <th scope="col">Property</th>
                <th scope="col">Value</th>
            </tr>
        </thead>
        <tbody>
    `;

    Object.entries(obj).forEach(([property, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            table += `
            <tr>
                <th scope="row">${property}</th>
                <td>${value}</td>
            </tr>
            `;
        }
    });

    table += `
        </tbody>
    </table>
    `;

    return table;
};

const closeMenu = (button, menu) => {
                menu.hidden = true;
            button.setAttribute("aria-expanded", false);
};

export const initRoadMenu = () => {
    document.getElementById("btn-menu").addEventListener("keydown", handleArrows);

    document.getElementById("menu").addEventListener("keydown", handleArrows);
    
    document.getElementById("menu-address").addEventListener("click", () => {

        fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${state.lat}&lon=${state.lon}&format=json`
        )
        .then(res => {
            if (!res.ok) {
                injectToModal(`<p>Unable to fetch address information. Please try again later.</p>`);
                return;
            }
            return res.json();
        })
        .then(data => {

            const addr = data.address ?? {};

            const tableData = {
                "Address Type": data.addresstype,
                "Display Name": data.display_name,
                "House Number": addr.house_number,
                "Road": addr.road,
                "Town": addr.town ?? addr.city,
                "County": addr.county,
                "State": addr.state,
                "Postcode": addr.postcode,
                "Country": addr.country
            };

            const content = makeTable(tableData);

            injectToModal(content);
        })
        .catch(error => {
            console.log(error);
        });
});

    document.getElementById("menu-street-details").addEventListener("click", () => {
        const street = state.intersection_graph.getStreet(state.current_neighbor.wayId);
        const details = {
            // Basic identification
            "Label": street.label,
            "Name": street.name,
            "Ref": street.ref,
            "Unsigned Ref": street.unsignedRef,

            // Alternate names
            "Official Name": street.officialName,
            "Alt Name": street.altName,
            "Old Name": street.oldName,
            "Local Name": street.localName,

            // Ownership / operation
            "Operator": street.operator,
            "Owner": street.owner,

            // Road / path classification
            "Type": street.highwayType,
            "Footway Type": street.footway,
            "Designation": street.designation,
            "Lanes": street.lanes,
            "Bike Access": street.bicycle,
            "Cycleway": street.cycleway,
            "Foot Access": street.foot,
            "Sidewalk": street.sidewalk,
            "Busway": street.busway,
            "Bus Lanes": street.busLanes,

            // Path-specific access / usage
            "Horse Access": street.horse,
            "Motor Vehicle Access": street.motorVehicle,
            "Motorcar Access": street.motorcar,
            "Segregated": street.segregated,

            // Traffic / routing
            "Speed Limit": street.maxSpeed,
            "Oneway": street.oneway,
            "Junction Type": street.junctionType,
            "Junction Ref": street.junctionRef,

            // Destinations
            "Destination": street.destination,
            "Destination Ref": street.destinationRef,
            "Destination Street": street.destinationStreet,

            // Physical characteristics
            "Surface": street.surface,
            "Smoothness": street.smoothness,
            "Incline": street.incline,
            "Width": street.width,
            "Toll": street.toll,
            "Bridge": street.bridge,
            "Access": street.access,
            "Layer": street.layer,
            "Tunnel": street.tunnel,

            // Pedestrian / accessibility
            "Crossing": street.crossing,
            "Crossing Signals": street.crossingSignals,
            "Tactile Paving": street.tactilePaving,
            "Wheelchair": street.wheelchair,
            "Lit": street.lit,

            // Hiking / trail information
            "SAC Scale": street.sacScale,
            "Trail Visibility": street.trailVisibility,

            // OSM
            "OSM Way ID": street.id
        };
        const htmlTable = makeTable(details);
        injectToModal(htmlTable);
    });

document.getElementById("menu-intersection-details").addEventListener("click", () => {
    const currentIntersection = state.intersection_graph.getIntersection(
        state.current_intersection
    );

    let htmlString = "";

    htmlString += `<h1>Intersection: ${currentIntersection.description}</h1>`;

    htmlString += `
        <p>
            <strong>Coordinates:</strong>
            ${currentIntersection.lat}, ${currentIntersection.lon}
        </p>
    `;

    htmlString += `<h2>Intersection Streets</h2>`;
    htmlString += `<ul>`;

    for (const e of currentIntersection.edges.values()) {
        htmlString += `
            <li>
                <strong>${e.segment.label}</strong>:
                heads ${Math.round(e.angle)} degrees ${e.cardinal}
            </li>
        `;
    }

    htmlString += `</ul>`;

    htmlString += `<h2>Additional Intersection Information</h2>`;

    if (
        !currentIntersection.tags ||
        Object.keys(currentIntersection.tags).length === 0
    ) {
        htmlString += `<p>No additional information available.</p>`;
    }
    else {
        const tags = currentIntersection.tags;
        function formatTagValue(value) {
            if (!value) return "";

            const values = {
                yes: "Yes",
                no: "No",
                unknown: "Unknown",
                traffic_signals: "Traffic signals",
                zebra: "Zebra crossing",
                marked: "Marked crossing",
                unmarked: "Unmarked crossing",
                button_operated: "Button operated",
            };

            return values[value] || value;
        }
        const intersectionInfo = {
            "Intersection Type": formatTagValue(tags.highway),
            "Crossing Type": formatTagValue(tags.crossing),
            "Crossing Signals": formatTagValue(tags.crossing_signals),
            "Tactile Paving": formatTagValue(tags.tactile_paving),
            "Traffic Signal Sound": formatTagValue(tags["traffic_signals:sound"]),
            "Traffic Signal Vibration": formatTagValue(tags["traffic_signals:vibration"]),
            "Accessible Kerb": formatTagValue(tags.kerb),
            "Kerb Height": formatTagValue(tags["kerb:height"]),
            "Lighting": formatTagValue(tags.lit),
            "Wheelchair Access": formatTagValue(tags.wheelchair),
            "Crossing Button": formatTagValue(tags.button_operated),
        };
        htmlString += makeTable(intersectionInfo);
    }

    injectToModal(htmlString);
});

    document.getElementById("menu-google-maps").addEventListener("click", () => {

        const lat = state.lat;
        const lon = state.lon;

        const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

        window.open(url, "_blank", "noopener,noreferrer");
        closeMenu(
            document.getElementById("btn-menu"),
            document.getElementById("menu")
        );
    });

    document.getElementById("menu-apple-maps").addEventListener("click", () => {

        const lat = state.lat;
        const lon = state.lon;

        const url = `https://maps.apple.com/?ll=${lat},${lon}&q=${lat},${lon}`;

        window.open(url, "_blank", "noopener,noreferrer");
        closeMenu(
            document.getElementById("btn-menu"),
            document.getElementById("menu")
        );
    });

    document.getElementById("menu-copy-coords").addEventListener("click", async () => {
        async function fallback(coords) {
            const input = document.createElement("input");
            input.type = "text";
            input.value = coords;
            input.readOnly = true;
            input.style.position = "fixed";
            input.style.top = 0;
            input.style.left = "-9999px";
            document.body.appendChild(input);
            input.select();
            const success = document.execCommand("copy");
            document.body.removeChild(input);
            if (success) {
                await showDialog(
                    "Coordinates copied to clipboard.",
                    "The coordinates have been copied to your clipboard."
                );
            }
            else {
                await showDialog(
                    "Fail to Copy to Clipboard",
                    "The coordinates were not able to be copied to your clipboard. Please try again later."
                );
            }
        }
        const coords = `${state.lat},${state.lon}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(coords);
            await showDialog(
                "Coordinates Copied",
                "The coordinates have been copied to your clipboard."
            );
        }
        catch (error) {
            fallback(coords);
        }
        }
        else fallback(coords);
        closeMenu(
            document.getElementById("btn-menu"),
            document.getElementById("menu")
        );
    });

document.getElementById("menu-clear-cache").addEventListener("click", async () => {
    const response = await showDialog(
        "Clear Stored Map Data?",
        "Are you sure you wish to clear all stored map data? Stored map data helps the application load faster. If you proceed, all stored map data will be deleted and cannot be recovered.",
        true
    );

    if (response) {
        try {
            await clearTilesFromCache();

            await showDialog(
                "Stored Map Data Deleted",
                "All stored map data has been deleted."
            );
        } catch (error) {
            console.error("Unable to clear stored map data:", error);

            await showDialog(
                "Stored Map Data Deleting Error",
                "Unable to delete stored map data."
            );
        }
    }

    closeMenu(
        document.getElementById("btn-menu"),
        document.getElementById("menu")
    );
});

document.getElementById("menu-keyboard-help").addEventListener("click", () => {
    let htmlString = "";

    // Navigation
    htmlString += "<h3 class='text-center fw-semibold mt-4 mb-3'>Navigation</h3>";
    const navigation = {
        "i": "Go forward",
        "J": "Turn left",
        "K": "Turn around",
        "L": "Turn right",
        "B": "Go to previous intersection"
    };
    htmlString += makeTable(navigation);

    // Information / Announcements
    htmlString += "<h3 class='text-center fw-semibold mt-4 mb-3'>Information</h3>";
    const information = {
        "A": "Announce current address",
        "C": "Announce current intersection",
        "H": "Announce current heading (degrees and direction)",
        "S": "Announce current street segment and next intersection",
        "X": "Examine intersection layout",
        "R": "Repeat last announcement"
    };
    htmlString += makeTable(information);

    // System / Mode Commands
    htmlString += "<h3 class='text-center fw-semibold mt-4 mb-3'>System</h3>";
    const system = {
        "Alt + A": "Address details",
        "Alt + D": "Street details",
        "Alt + C": "Copy coordinates",
        "Alt + N": "Explore new location",
        "Alt + S": "Switch to explore mode",
        "Alt + R": "Refresh road data",
        "Alt + U": "Enable or disable unnamed roads",
        "Alt + m": "Open more options menu"
    };
    htmlString += makeTable(system);

    // Help
    htmlString += "<h3 class='text-center fw-semibold mt-4 mb-3'>Help</h3>";
    const help = {
        "Alt + /": "Open keyboard help"
    };
    htmlString += makeTable(help);

    injectToModal(htmlString);
});

    document.getElementById("menu-close").addEventListener("click", () => {
        closeMenu(
            document.getElementById("btn-menu"),
            document.getElementById("menu")
        );
    });
};
