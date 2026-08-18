# Blind World Explorer

## Overview

Blind World Explorer is a web-based navigation application designed to make the world easier to understand and explore for blind and visually impaired users.

Rather than relying on traditional visual maps, Blind World Explorer converts geographic information into an interactive, keyboard-driven exploration experience. Users can navigate cities, roads, intersections, cycling paths, and other OpenStreetMap features through speech and accessible controls.

The application provides two different exploration layers:

* **Free Explore Mode** – Explore any location using coordinates and directional movement.
* **Road Mode** – Navigate along a graph of real-world streets and intersections generated from OpenStreetMap data.

Because locations are stored directly in the URL, users can share exact locations and continue exploring from the same coordinates and navigation mode.

---

## Features

### Starting a New Exploration Session

Users can begin exploring in several different ways:

* Start at the current device location
* Enter decimal latitude and longitude coordinates
* Search for a location using OpenStreetMap's geocoding service
* Select a city from a predefined list of locations

---

## Free Explore Mode

Free Explore Mode is the default navigation layer.

When a location is selected, the application reverse-geocodes the coordinates and announces the current address to the user.

### Navigation

Users can freely move through the world using directional controls.

By default:

* Turning rotates the user by **45 degrees**
* Moving forward advances the user by **300 feet**

Both values can be customized through the settings menu.

### Keyboard Commands

#### Navigation

| Key | Action                      |
| --- | --------------------------- |
| I   | Go forward                  |
| J   | Turn left                   |
| K   | Turn around                 |
| L   | Turn right                  |
| B   | Go to the previous position |
| +   | Increase movement distance  |
| -   | Decrease movement distance  |

#### Information

| Key | Action                                                        |
| --- | ------------------------------------------------------------- |
| A   | Announce the current address                                  |
| H   | Announce the current heading (degrees and cardinal direction) |
| R   | Repeat the last announcement                                  |

#### System

| Key     | Action                 |
| ------- | ---------------------- |
| Alt + A | Open address details   |
| Alt + C | Copy coordinates       |
| Alt + N | Explore a new location |
| Alt + S | Switch to Road Mode    |
| Alt + O | Open explorer settings |
| Alt + M | Open the options menu  |

#### Help

| Key     | Action             |
| ------- | ------------------ |
| Alt + / | Open keyboard help |

### Navigation Settings

Users can customize:

* Movement distance
* Distance units (feet, meters, kilometers, or miles)
* Rotation increments
* The current heading in degrees

These settings allow users to tailor the exploration experience to their preferences.

---

## Road Mode

Road Mode transforms OpenStreetMap road data into an interactive graph of intersections.

When Road Mode is activated, the application queries the Overpass API and constructs a graph consisting of:

* Intersections (nodes)
* Road segments (edges)

Instead of moving through open space, users navigate from one intersection to another.

### Street-Following Behavior

When moving forward, the application automatically determines which street to follow.

By default, the system attempts to keep users on the same street and continue moving in the current direction.

At intersections that are not traditional four-way intersections, the application selects the street whose angle most closely matches the previous direction of travel.

This behavior helps preserve orientation and creates a more natural navigation experience.

### Unnamed Roads

By default, unnamed roads are disabled.

Users can enable unnamed roads to explore additional OpenStreetMap features, including:

* Parking lots
* Service roads
* Cycling paths
* Bike trails
* Other unnamed transportation routes

### Keyboard Commands

#### Navigation

| Key | Action                          |
| --- | ------------------------------- |
| I   | Go forward                      |
| J   | Turn left                       |
| K   | Turn around                     |
| L   | Turn right                      |
| B   | Go to the previous intersection |

#### Information

| Key | Action                                                        |
| --- | ------------------------------------------------------------- |
| A   | Announce the current address                                  |
| C   | Announce the current intersection                             |
| H   | Announce the current heading (degrees and cardinal direction) |
| S   | Announce the current street segment and the next intersection |
| X   | Examine the current intersection layout                       |
| R   | Repeat the last announcement                                  |

#### System

| Key     | Action                          |
| ------- | ------------------------------- |
| Alt + A | Open address details            |
| Alt + D | Open street details             |
| Alt + C | Copy coordinates                |
| Alt + N | Explore a new location          |
| Alt + S | Switch to Free Explore Mode     |
| Alt + R | Refresh road data               |
| Alt + U | Enable or disable unnamed roads |
| Alt + M | Open the options menu           |

#### Help

| Key     | Action             |
| ------- | ------------------ |
| Alt + / | Open keyboard help |

---

## Additional Features

### Address Information

Display detailed address information for the current location, including:

* Road
* City
* County
* State
* Postal code
* Country

### Street Details

Display OpenStreetMap metadata for the current street segment, including:

* Street name
* Road type
* Speed limit
* Number of lanes
* Bicycle information
* Sidewalk information
* Surface type
* One-way status
* Bridge information
* Destination information

### External Maps

Open the current location in:

* Google Maps
* Apple Maps

### Copy Coordinates

Copy the current coordinates directly to the clipboard.

---

## Shareable URLs

Blind World Explorer stores navigation information directly in the URL.

Shared URLs preserve:

* Coordinates
* Navigation mode

Opening a shared URL restores the exact location and the active exploration layer.

---

## Tile-Based Road Loading

Road Mode uses a tile-based loading system.

The world is divided into **5 km × 5 km tiles**.

When Road Mode is activated, the application loads:

* The current tile
* The northern tile
* The southern tile
* The eastern tile
* The western tile

Diagonal tiles are intentionally ignored because OpenStreetMap road data frequently extends beyond tile boundaries.

An additional **200-meter padding area** is added to each tile to ensure roads connect seamlessly across tile borders.

---

## Automatic Tile Updates

As users move through the world, the application continuously monitors their position.

Additional road data is automatically loaded when:

* Users approach a tile boundary
* Users enter an area whose road data has not yet been loaded

In theory, users can continue exploring roads for hundreds of miles without manually refreshing or reloading the application.

---

## Tile Caching

All downloaded tiles are automatically cached using the browser's IndexedDB storage.

Caching provides several advantages:

* Faster loading
* Fewer network requests
* Reduced dependence on the Overpass API
* Improved responsiveness

Cached tiles currently remain stored until they are manually deleted.

A cache management option will be added in a future release.

---

## Manual Refresh

Because the Overpass API is a public service, network requests can occasionally fail.

If an automatic update does not complete successfully, users can press the **Refresh** button to reload:

* The current tile
* Surrounding tiles

This provides a fallback mechanism that helps ensure navigation can continue.

---

## Technologies Used

* JavaScript
* Bootstrap
* OpenStreetMap
* Nominatim
* Overpass API
* IndexedDB

---

## Accessibility

Blind World Explorer was designed specifically for blind and visually impaired users.

Accessibility features include:

* Keyboard-first navigation
* Screen reader announcements
* Semantic HTML
* Accessible dialogs
* Configurable movement and orientation controls

The goal of the project is not to replace traditional GPS navigation, but to provide blind users with a tool for understanding, exploring, and experiencing the world's geography.
