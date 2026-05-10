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
    this.id = String(osmWay.id);
    this.name = osmWay.tags?.name || null;
    this.ref = osmWay.tags?.ref || null;
    this.highwayType = osmWay.tags?.highway || "road";
    this.junctionType = osmWay.tags?.junction || null;
    this.destination = osmWay.tags?.destination || null;
    this.destinationRef = osmWay.tags?.["destination:ref"] || null;
    this.destinationStreet = osmWay.tags?.["destination:street"] ?? null;
    this.junctionRef = osmWay.tags?.["junction:ref"] || null;
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
    if (this.junctionType === "roundabout") return "Roundabout";

    if (
      this.highwayType === "primary_link"
      || this.highwayType === "secondary_link"
      || this.highwayType === "tertiary_link"
    ) return "Merging Lane";

    if (this.highwayType === "motorway_link") {
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
    return (
      !this.ref
      && !this.name
      && this.junctionType !== "roundabout"
      && this.highwayType !== "motorway_link"
    );
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
}
