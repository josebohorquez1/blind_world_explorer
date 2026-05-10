/**
 * A directed connection between two adjacent intersection nodes along a street.
 *
 * Fields:
 *   from     {Intersection}  Origin intersection
 *   to       {Intersection}  Destination intersection
 *   street   {Street}        The street this edge follows
 *   distance {number}        Distance in meters between from and to
 *   angle    {number}        Bearing in degrees (0–360) from from to to
 *   cardinal {string}        Cardinal direction label (e.g. "North", "Southwest")
 */
export class Edge {
  /**
   * @param {Intersection} from
   * @param {Intersection} to
   * @param {Street}       street
   * @param {number}       distance  Meters
   * @param {number}       angle     Bearing in degrees
   * @param {string}       cardinal  Cardinal direction label
   */
  constructor(from, to, street, distance, angle, cardinal) {
    this.from = from;
    this.to = to;
    this.street = street;
    this.distance = distance;
    this.angle = angle;
    this.cardinal = cardinal;
  }
  get id() {
    return `${this.from.id}_${this.to.id}_${this.street.id}`;
  }
}
