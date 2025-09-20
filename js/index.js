//Import modules
import { state } from "./state.js"; //Holds the variables
import* as Utils from "./UtilFunctions.js"; //Holds the utility functions
import * as Map from "./Map.js"; //Holds the map data functions
import { initStartScreen } from "./Start.js";
import { initSearchEvent } from "./Search.js"; //Contains the search functionality
import { initSettingsEvents } from "./Settings.js"; //Holds the events for the different settings
import { initButtons } from "./Buttons.js"; //Contains the button events

//Code will fire upon page load
document.addEventListener("DOMContentLoaded", () => {
    initStartScreen();
    initSearchEvent() //Initializes search functionality
    initSettingsEvents() //Initializes settings events
    initButtons(); //Initializes button events
});