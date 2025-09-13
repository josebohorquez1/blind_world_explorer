//File for all button events

//Importing utility functions since the button events rely on them
//Importing state since some buttons change the current state
import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";

//Function wrapper for all button event to easily export them
export const initButtons = () => {
    //Turn buttons
    document.querySelector("#turnLeft").addEventListener("click", () => {
        state.current_heading = Utils.updateHeading(state.current_heading - state.current_rotation_increment);
    });
    document.querySelector("#turnRight").addEventListener("click", () => {
        state.current_heading = Utils.updateHeading(state.current_heading + state.current_rotation_increment);
    });
    document.querySelector("#go").addEventListener("click", () => {
        const {lat: new_lat, lon: new_lon} = Utils.move(state.lat, state.lon, state.current_moving_distance, state.current_heading);
        state.lat = new_lat;
        state.lon = new_lon;
        Utils.updateStatus(state.lat, state.lon);
        Utils.srAnnounce(document.querySelector("#announcement"), `Moved ${Utils.printDistance(state.current_moving_distance)} ${state.directions[Math.round(state.current_heading / 45) % 8]}.`);
    });
};
