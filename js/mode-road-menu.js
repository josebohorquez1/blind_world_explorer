import { switchApplicationView } from "./loader.js"
import { state } from "./state.js";
import * as Utils from "./UtilFunctions.js"

const injectToModal = async (content) => {
    await switchApplicationView(
        "pages/details-modal.html",
        document.getElementById("app-mount")
    );
    document.getElementById("modal-content").innerHTML = content;
}

export const initRoadMenu = () => {
    document.getElementById("menu-address").addEventListener("click", () => {
        fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${state.lat}&lon=${state.lon}&format=json`
        ).then(res => {
            if (!res.ok) {
                injectToModal(`<p>Unable to fetch address information. Please try again later.</p>`);
                return;
            }
            return res.json();
        }).then(data => {

            let content = `
            <table class="table table-striped table-sm">
                <thead>
                    <tr>
                        <th scope="col">Property</th>
                        <th scope="col">Value</th>
                    </tr>
                </thead>
                <tbody>
            `;

            /* Top-level fields */
            if (data.addresstype) {
                content += `
                <tr>
                    <th scope="row">Address Type</th>
                    <td>${data.addresstype}</td>
                </tr>`;
            }

            if (data.display_name) {
                content += `
                <tr>
                    <th scope="row">Display Name</th>
                    <td>${data.display_name}</td>
                </tr>`;
            }

            /* Address object fields */
            if (data.address) {
                const addr = data.address;

                const fields = [
                    ["House Number", addr.house_number],
                    ["Road", addr.road],
                    ["Town", addr.town],
                    ["City", addr.city],
                    ["County", addr.county],
                    ["State", addr.state],
                    ["Postcode", addr.postcode],
                    ["Country", addr.country]
                ];

                fields.forEach(([label, value]) => {
                    if (value) {
                        content += `
                        <tr>
                            <th scope="row">${label}</th>
                            <td>${value}</td>
                        </tr>`;
                    }
                });
            }

            content += `
                </tbody>
            </table>
            `;

            injectToModal(content);

        }).catch(error => {
            console.log(error);
        });
    });
};
