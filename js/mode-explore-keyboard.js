import * as ExploreUtils from "./mode-explore-utils.js";
import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";

//Constants
const statusMount = document.getElementById("status-text");
const announcementsMount = document.getElementById("announcements-mount");

/**
 * Runs the specific function based on the key pressed
 * @param {Event} event 
 */
export const keyboardEvents = async (event) => {
    const keyPressed = event.key;
const target = event.target;
if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
) {
    return;
}
switch (keyPressed) {
        //Navigation
        case "i": {
            ExploreUtils.moveForward();
            break;
        }
            case "j":
                ExploreUtils.turnLeft();
                break;
                case "k":
                    ExploreUtils.turnAround();
                    break;
                    case "l":
                        ExploreUtils.turnRight();
                        break;
                        case "b":
                            ExploreUtils.movePrevious();
                            break;
                            case "+":
                                ExploreUtils.increaseDistance();
                                break;
                                case "-":
                                    ExploreUtils.decreaseDistance();
                                    break;
                            //Information
                            case "a":
                                await ExploreUtils.reportCurrentLocation();
                                break;
                                case "h": {
                                    const bearing = state.current_heading;
                                    const direction = Utils.getCardinalDirection(state.current_heading);
                                    const headingStr = `<p>Heading ${bearing} degrees, ${direction}</p>`;
                                    Utils.srAnnounce(announcementsMount, headingStr);
                                    break;
                                }
                                case "r": {
                                    const lastStr = announcementsMount.innerHTML;
                                    Utils.srAnnounce(announcementsMount, lastStr);
                                    break;
                                }
                                default:
                                    break;
    }
};

export const initkeyboardEvents = () => {
    document.addEventListener("keydown", keyboardEvents);
};
