//Utility functions that will be used across the code base

//Importing current state for announcements
import { state } from "./state.js";
//Function to fetch current location address
export const updateStatus = async (lat, lon) => {
    let description;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const data = await res.json();
        if (data.display_name) description = `Current Location: ${data.display_name}`;
        else description = `Current Location: ${lat}, ${lon}`;
    }
    catch {
        description = `Current Location: ${lat}, ${lon}`;
    }
    srAnnounce(document.getElementById("status"), description);
};

//Function to announce updates to screen readers
export const srAnnounce = (element, message) => {
    element.innerHTML = "";
    setTimeout(() => {
        element.innerHTML = message;
    }, 50);
};

//Print distance in miles for ditances greater than 0.1 miles, otherwise print in feet.
export const printDistance = (distance_in_meters) => {
    if (distance_in_meters < 158.4) return `${Math.floor(distance_in_meters / 0.3)} feet`;
    else return `${(distance_in_meters / 1609).toFixed(1)} miles`;
}

//Function to update current heading direction and normalize the heading from 0-359
export const updateHeading = (heading) => {
    let new_heading = (heading + 360) % 360;
    srAnnounce(document.getElementById("heading"), `Heading: ${new_heading} degrees ${state.directions[Math.round(new_heading / 45) % 8]}`);
    return new_heading;
};

//Function to determine new lat lon coordinates based on current coordinates, distance to move, and direction to move
export const move = (lat1, lon1, moving_distance, heading) => {
const R = 6371000;
const rad = Math.PI / 180;
const deg = 180 / Math.PI;
lat1 *= rad;
lon1 *= rad;
const heading_r = heading * rad;
const angular_distance = moving_distance / R;
const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular_distance) +
Math.cos(lat1) * Math.sin(angular_distance) * Math.cos(heading_r)
);
const lon2 = lon1 + Math.atan2(
Math.sin(heading_r) * Math.sin(angular_distance) * Math.cos(lat1),
Math.cos(angular_distance) - Math.sin(lat1) * Math.sin(lat2)
);
const new_lat = lat2 * deg;
const new_lon = lon2 * deg;
return {lat: new_lat, lon: new_lon};
};

//Calculates the distance between coordinates
export const calculateDistanceBetweenCordinates = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

//Function to fetch search results based on search term and current coordinates


