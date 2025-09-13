//File to store the state of the global variables to be used across the code base

//Object storing the current state of global variables
export const state = {
    lat: 0, //Current lat in decimal degrees
    lon: 0, //Current lon in decamal degrees
    current_heading: 0, //Current directional heading in degrees
    current_moving_distance: 90, //in meters
    current_rotation_increment: 45, //Increment for left and right turn buttons in degrees
    directions: ["North", "Northeast", "East", "Southeast", "South", "Southwest", "West", "Northwest"], //List of directions to be used for indexing
    location_history: [] //Stores the coordinates of each point visited
};