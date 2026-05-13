import { initDetailsModal } from "./details-modal.js";
import { switchApplicationView } from "./loader.js";
import { state } from "./state.js";
import * as Utils from "./UtilFunctions.js";

const injectToModal = async (content) => {
    await switchApplicationView(
        "pages/details-modal.html",
        document.getElementById("app-mount"),
        initDetailsModal
    );
    document.getElementById("modal-content").innerHTML = content;
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
        const street = state.current_road.street;
        const details = {
            "Label": street.label,
            "Name": street.name,
            "Ref": street.ref,
            "Unsigned Ref": street.details.tags.unsigned_ref,
            "Type": street.highwayType,
            "Lanes": street.details.tags.lanes,
            "Has Bike Lane": street.details.tags.bicycle,
            "Is Cycleway": street.details.tags.cycleway,
            "Has Sidewalk": street.details.tags.foot,
            "Sidewalk": street.details.tags.sidewalk,
            "Speed Limit": street.details.tags.maxspeed,
            "Is Oneway": street.details.oneway,
            "Junction Type": street.junctionType,
            "Junction Ref": street.junctionRef,
            "Destination": street.destination,
            "Destination Ref": street.destinationRef,
            "Destination Street": street.destinationStreet,
            "Surface": street.details.tags.surface,
            "has Toll": street.details.tags.toll,
            "Is Bridge": street.details.tags.bridge
        };
        const htmlTable = makeTable(details);
        console.log(street.details)
        injectToModal(htmlTable);
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

    document.getElementById("menu-close").addEventListener("click", () => {
        closeMenu(
            document.getElementById("btn-menu"),
            document.getElementById("menu")
        );
    });
};
