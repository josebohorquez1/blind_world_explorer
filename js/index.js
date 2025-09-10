    let lat = 40.7128;
    let lon = -74.0060;
document.addEventListener("DOMContentLoaded", () => {
    const map_content = document.getElementById("mapContent");
    let best_position = null;
    let watch_position_id = null;
    let current_heading = 0; //indegrees, normalized
    let current_moving_distance = 90; //in meters
    const srAnnounce = (element, message) => {
        element.innerHTML = "";
        setTimeout(() => {
            element.innerHTML = message;
        }, 50);
    };
    const printDistance = (distance_in_meters) => {
        const distance_in_miles = (distance_in_meters / 1609).toFixed(2);
        if (distance_in_miles < 0.1) return `${Math.round((distance_in_miles * 5280) / 50) * 50} feet`;
        else return `${distance_in_miles} miles`;
    }
    const directions = ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"];
    async function updateStatus(lat, lon) {
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
    }
    if (navigator.geolocation) {
    watch_position_id = navigator.geolocation.watchPosition((position) => {
        document.querySelectorAll("div.turn-buttons button").forEach(button => button.disabled = true);
        document.querySelector("#searchBox").disabled = true;
        const {latitude, longitude, accuracy} = position.coords;
        if (!best_position || accuracy < best_position.coords.accuracy) best_position = position;
    }, (err) => {
        updateStatus(lat, lon);
    }, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 1000
    });
    setTimeout(() => {
        if (watch_position_id) navigator.geolocation.clearWatch(watch_position_id);
        if (best_position) {
            const {latitude, longitude, accuracy} = best_position.coords;
            updateStatus(latitude, longitude);
            lat = latitude;
            lon = longitude;
        }
        document.querySelectorAll("div.turn-buttons button").forEach(button => button.disabled = false);
        document.querySelector("#searchBox").disabled = false;
    }, 10000);
    }
    else updateStatus(lat, lon, 0);
    const updateHeading = () => {
        current_heading = (current_heading + 360) % 360;
        srAnnounce(document.getElementById("heading"), `Heading: ${current_heading} degrees ${directions[Math.round(current_heading / 45) % 8]}`);
    };
    updateHeading();
    document.getElementById("turnLeft").addEventListener("click", () => {
        current_heading -= 45;
        updateHeading();
    });
    document.getElementById("turnRight").addEventListener("click", () => {
        current_heading += 45;
        updateHeading();
    });
        const move = (lat1, lon1, moving_distance, heading) => {
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
function calculateDistanceBetweenCordinates(lat1, lon1, lat2, lon2) {
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
}    
    document.getElementById("go").addEventListener("click", (e) => {
        e.preventDefault();
        const {lat: new_lat, lon: new_lon} = move(lat, lon, current_moving_distance, current_heading);
        lat = new_lat;
        lon = new_lon;
        updateStatus(lat, lon);
        srAnnounce(document.getElementById("announcement"), `Moved ${printDistance(current_moving_distance)} ${directions[current_heading / 45 % 8]}.`);
    });
    const runSearch = async (query) => {
        if (!query) return null;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&lat=${lat}&lon=${lon}`;
        try {
            const res = await fetch(url, {headers: {"Accept-Language": "en"}});
            const data = await res.json();
            if (!data) return 0;
            const results_by_distance = data.map(point => {
                const d = calculateDistanceBetweenCordinates(lat, lon, parseFloat(point.lat), parseFloat(point.lon));
                return {...point, distance: d};
            }).sort((a, b) => a.distance - b.distance);
            return results_by_distance;
        }
        catch (err) {
            return -1;
        }
    };
    let search_timer;
    document.getElementById("searchBox").addEventListener("input", async (e) => {
        const query = document.getElementById("searchBox").value.trim();
        const results_area = document.getElementById("searchResults");
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
            html += `<li><button data-lat="${point.lat}" data-lon=${point.lon}">${point.display_name}, ${printDistance(point.distance)} away</button></li>`;
        });
        html+= `</ul>`;
        results_area.innerHTML = html;
            document.querySelectorAll("#searchResults ul li button").forEach(button => {
                button.addEventListener("click", () => {
                    lat= parseFloat(button.dataset.lat);
                    lon= parseFloat(button.dataset.lon);
                    updateStatus(lat, lon);
                    results_area.innerHTML = "";
                });
            });
                }, 500);
    });
});