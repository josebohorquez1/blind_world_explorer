/**
 * Represents a named road segment (OSM Way) connecting two intersections.
 *
 * Fields:
 *   id              {string}       OSM way ID
 *   name            {string|null}  Road name (e.g. "University Avenue")
 *   ref             {string|null}  Road reference number (e.g. "US-441")
 *   highwayType     {string}       OSM highway tag value (e.g. "residential")
 *   junctionType    {string|null}  OSM junction tag value (e.g. "roundabout")
 *   destination     {string|null}  OSM destination tag (e.g. "Downtown")
 *   destinationRef  {string|null}  OSM destination:ref tag (e.g. "I-75")
 *   destinationStreet {string|null} OSM destination:street tag
 *   junctionRef     {string|null}  OSM junction:ref tag (exit number)
 *   nodeIds         {string[]}     Ordered OSM node IDs along this way
 */
export class Street {
  /**
   * @param {object} osmWay  Raw OSM way element from an Overpass JSON response
   */
  constructor(osmWay) {
      const tags = osmWay.tags || {};
      this.id = String(osmWay.id);

      // Basic identification
      this.name = tags.name || null;
      this.ref = tags.ref || null;
      this.unsignedRef = tags.unsigned_ref || null;

      // Alternate names
      this.officialName = tags.official_name || null;
      this.altName = tags.alt_name || null;
      this.oldName = tags.old_name || null;
      this.localName = tags.loc_name || null;

      // Ownership / operation
      this.operator = tags.operator || null;
      this.owner = tags.owner || null;

      // Road / path classification
      this.highwayType = tags.highway || "road";
      this.footway = tags.footway || null;
      this.designation = tags.designation || null;

      this.lanes = tags.lanes || null;
      this.bicycle = tags.bicycle || null;
      this.cycleway = tags.cycleway || null;
      this.foot = tags.foot || null;
      this.sidewalk = tags.sidewalk || null;
      this.busway = tags.busway || null;
      this.busLanes = tags["lanes:bus"] || null;

      // Path-specific access / usage
      this.horse = tags.horse || null;
      this.motorVehicle = tags.motor_vehicle || null;
      this.motorcar = tags.motorcar || null;
      this.segregated = tags.segregated || null;

      // Traffic / routing
      this.maxSpeed = tags.maxspeed || null;
      this.oneway = tags.oneway || null;
      this.junctionType = tags.junction || null;
      this.junctionRef = tags["junction:ref"] || null;

      // Destinations
      this.destination = tags.destination || null;
      this.destinationRef = tags["destination:ref"] || null;
      this.destinationStreet = tags["destination:street"] || null;

      // Physical characteristics
      this.surface = tags.surface || null;
      this.smoothness = tags.smoothness || null;
      this.incline = tags.incline || null;
      this.width = tags.width || null;
      this.toll = tags.toll || null;
      this.bridge = tags.bridge || null;
      this.access = tags.access || null;
      this.layer = tags.layer || null;
      this.tunnel = tags.tunnel || null;

      // Pedestrian / accessibility
      this.crossing = tags.crossing || null;
      this.crossingSignals = tags.crossing_signals || null;
      this.tactilePaving = tags.tactile_paving || null;
      this.wheelchair = tags.wheelchair || null;
      this.lit = tags.lit || null;

      // Hiking / trail information
      this.sacScale = tags.sac_scale || null;
      this.trailVisibility = tags.trail_visibility || null;

      // OSM geometry
      this.nodeIds = (osmWay.nodes || []).map(String);
  }

  /**
   * Human-readable display label for this street, derived from available OSM tags.
   *
   * Priority: name > ref > highway-type fallback > "Road".
   * For motorway links, builds an "Exit N to X towards Y" or "Ramp to X" string.
   *
   * @returns {string}
   */
  get label() {
    if (this.name) return this.name;
    if (this.ref) return this.ref;
    if (this.highwayType === "service") return "Service Road";
    if (this.highwayType === "residential") return "Residential Street";
    if (this.highwayType === "construction") return "Construction";
    if (this.highwayType === "cycleway") return "Bike Path";
    if (this.highwayType === "footway") return "Walking Path";
    if (this.highwayType === "path") return "Path";
    if (this.highwayType === "pedestrian") return "Pedestrian Street";
    if (this.junctionType === "roundabout") return "Roundabout";

    if (
      this.highwayType === "primary_link"
      || this.highwayType === "secondary_link"
      || this.highwayType === "tertiary_link"
      || this.highwayType === "trunk_link"
    ) return "Merging Lane";

    if (
      this.highwayType === "motorway_link"
    ) {
      const hasNoSignage = (
        !this.junctionRef
        && !this.destinationRef
        && !this.destination
        && !this.destinationStreet
      );
      if (hasNoSignage) return "Ramp";

      if (this.junctionRef) {
        return (
          `Exit ${this.junctionRef}`
          + `${this.destinationRef ? ` to ${this.destinationRef}` : ``}`
          + `${this.destination ? ` towards ${this.destination}` : ``}`
        );
      }

      // Combine ref and street name if both are present (e.g. "I-75 Main Street")
      const toText = (this.destinationRef && this.destinationStreet)
        ? `${this.destinationRef} ${this.destinationStreet}`
        : this.destinationRef || this.destinationStreet || "";

      return (
        `Ramp`
        + `${toText ? ` to ${toText}` : ``}`
        + `${this.destination ? ` towards ${this.destination}` : ``}`
      );
    }

    return "Road";
  }

  /**
   * True if this street has no meaningful identifying label:
   * no name, no ref, not a roundabout, and not a motorway link.
   *
   * @returns {boolean}
   */
get isUnnamed() {
  const disallowedHighwayTypes = [
    "primary_link",
    "secondary_link",
    "tertiary_link",
    "trunk_link",
    "cycleway",
    "footway",
    "path",
    "pedestrian",
    "construction"
  ];

  // Motorways and motorway_links are never unnamed
  if (this.highwayType === "motorway" || this.highwayType === "motorway_link") {
    return false;
  }

  //Roundabouts are allowed
  if (this.junctionType === "roundabout") {
    return false;
  }
  
  // Roads with names/refs are allowed unless disallowed
  if ((this.name || this.ref) && !disallowedHighwayTypes.includes(this.highwayType)) {
    return false;
  }

  return true;
}

  /**
   * Returns the beginning node
   */
  get beginningNode() {
    return this.nodeIds[0];
  }

  /**
   * Returns the end node
   */
  get endNode() {
    return this.nodeIds[this.nodeIds.length - 1];
  }

get key() {
  function normalizeStreetName(name) {
    if (!name) return null;

    const map = {
      st: "street",
      rd: "road",
      ave: "avenue",
      av: "avenue",
      blvd: "boulevard",
      dr: "drive",
      ln: "lane",
      ct: "court",
      pl: "place",
      hwy: "highway",
      pkwy: "parkway",
      cir: "circle",
      ter: "terrace"
    };

    return name
      .toLowerCase()
      .replace(/\./g, "")
      .trim()
      .split(/\s+/)
      .map(w => map[w] || w)
      .join(" ");
  }

  function normalizeRef(ref) {
    if (!ref) return null;

    const refs = ref
      .split(";")
      .map(r =>
        r
          .toLowerCase()
          .replace(/\./g, "")
          .replace(/\s+/g, "")
          .trim()
      )
      .filter(Boolean)
      .sort();

    return refs.join("/");
  }

  const name = normalizeStreetName(this.name);
  const ref = normalizeRef(this.ref);

  if (ref && name) {
    return `${this.highwayType}/${ref}/${name}`;
  }

  if (ref) {
    return `${this.highwayType}/${ref}`;
  }

  if (name) {
    return `${this.highwayType}/${name}`;
  }

  if (this.junctionType === "roundabout") {
    return "roundabout";
  }

  if (
    this.highwayType === "primary_link" ||
    this.highwayType === "secondary_link" ||
    this.highwayType === "tertiary_link" ||
    this.highwayType === "trunk_link"
  ) {
    return "merge";
  }

  if (
    this.highwayType === "motorway_link"
  ) {
    const hasNoSignage =
      !this.junctionRef &&
      !this.destination &&
      !this.destinationRef &&
      !this.destinationStreet;

    if (hasNoSignage) {
      return `${this.highwayType}/ramp`;
    }

    const parts = [];

    if (this.junctionRef) {
      parts.push(this.junctionRef.toLowerCase().trim());
    }

    if (this.destination) {
      parts.push(
        this.destination.toLowerCase().replace(/\./g, "").trim()
      );
    }

    if (this.destinationRef) {
      parts.push(normalizeRef(this.destinationRef));
    }

    if (this.destinationStreet) {
      parts.push(normalizeStreetName(this.destinationStreet));
    }

    return `${this.highwayType}/${parts.join("/")}`;
  }

  if (this.highwayType === "service") {
    return "service";
  }

  if (this.highwayType === "residential") {
    return "residential";
  }

  return "road";
}
}
