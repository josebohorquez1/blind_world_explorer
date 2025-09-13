//File containing the settings for the application

//Importing state variables
import { state } from "./state.js";
//Import utility functions
import * as Utils from "./UtilFunctions.js";

//Utility function to update the moving distance since both the input box and combo box should update the setting
const updateMovementDistance = () => {
    let distance = parseFloat(document.getElementById("movingDistanceBox").value);
    const unit = document.getElementById("movingDistanceUnit").value;
    const settings_announcement = document.getElementById("settingsAnnouncement");
    if(!distance) distance = 1;
    if (unit == "feet") {
        Utils.srAnnounce(settings_announcement, `Movement distance updated to ${distance} ${unit}.`);
        distance *= 0.3;
    }
    else if (unit == "kilometers") {
        Utils.srAnnounce(settings_announcement, `Movement distance updated to ${distance} ${unit}.`);
        distance *= 1000;
    }
    else if (unit == "miles") {
        Utils.srAnnounce(settings_announcement, `Movement distance updated to ${distance} ${unit}.`);
        distance *= 1609;
    }
    else             Utils.srAnnounce(settings_announcement, `Movement distance updated to ${distance} ${unit}.`);
    state.current_moving_distance = distance;
};

//Function to fire the different events to update settings
export const initSettingsEvents = () => {
    //Event to update the distance upon input of a number
    document.getElementById("movingDistanceBox").addEventListener("input", updateMovementDistance);
    //Event to update the distance based on the unit
    document.getElementById("movingDistanceUnit").addEventListener("input", updateMovementDistance);
    //Event to update the current direction
    document.getElementById("currentDirectionBox").addEventListener("input", (e) => {
        let new_heading = parseFloat(e.target.value);
        if (!e.target.value) new_heading = 0;
        if (e.target.value > 359) new_heading = 359;
        state.current_heading = Utils.updateHeading(new_heading);
        Utils.srAnnounce(document.getElementById("settingsAnnouncement"), `Updated movement direction to ${new_heading} degrees.`);
    });
    //Event to update the current rotation increment setting for the turn buttons
    document.getElementById("rotationIncrementBox").addEventListener("input", (e) => {
        let new_rotation_increment = parseFloat(e.target.value);
        if (!e.target.value) new_rotation_increment = 45;
        if (e.target.value > 180) new_rotation_increment = 180;
        state.current_rotation_increment = new_rotation_increment;
        Utils.srAnnounce(document.getElementById("settingsAnnouncement"), `Update turn buttons rotation increment to ${new_rotation_increment} degrees.`);
    });
};
