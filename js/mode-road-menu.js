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

export const initRoadMenu = () => {
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
};
