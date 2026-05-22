import * as RoadUtils from "./mode-road-utils.js";
import * as Utils from "./UtilFunctions.js";
import { state } from "./state.js";

//Constants
const statusMount = document.getElementById("status-text");
const announcementsMount = document.getElementById("announcements-mount");

/**
 * Runs the specific function based on the key pressed
 * @param {Event} event 
 */
const keyboardEvents = async (event) => {
    event.preventDefault();
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
        case " ": {
            RoadUtils.moveForward();
            break;
        }
            case "j":
                RoadUtils.turnLeft();
                break;
                case "k":
                    RoadUtils.turnAround();
                    break;
                    case "l":
                        RoadUtils.turnRight();
                        break;
                        case "b":
                            RoadUtils.movePrevious();
                            break;
                            //Information
                            case "a":
                                await RoadUtils.announceCurrentAddress();
                                break;
                                case "c": {
                                    const currentIntersection = state.intersection_graph.getIntersection(state.current_intersection);
                                    const currentIntersectionStr = currentIntersection ? currentIntersection.description : "Unable to announce current intersection.";
                                    Utils.srAnnounce(statusMount, currentIntersectionStr);
                                    break;
                                }
                                case "h": {
                                    const bearing = state.current_heading;
                                    const direction = Utils.getCardinalDirection(state.current_heading);
                                    const headingStr = `<p>Heading ${bearing} degrees, ${direction}</p>`;
                                    Utils.srAnnounce(announcementsMount, headingStr);
                                    break;
                                }
                                case "s": {
                                    const alignmentAnnouncement = RoadUtils.updateAlignment(state.current_heading, state.current_intersection, "", false);
                                    Utils.srAnnounce(announcementsMount, alignmentAnnouncement);
                                    break;
                                }
                                case "x": {
                                    const intersection = state.intersection_graph.getIntersection(state.current_intersection);
                                    const description = intersection.description;
                                    const alignAnnouncement = RoadUtils.updateAlignment(state.current_heading, state.current_intersection, "", true);
                                    const announcement = `<p>${description}</p>
                                        ${alignAnnouncement}`;
                                        Utils.srAnnounce(announcementsMount, announcement);
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
}

export const initkeyboardEvents = () => {
    document.addEventListener("keydown", keyboardEvents);
}
