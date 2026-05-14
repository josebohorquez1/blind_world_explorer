import { Street } from "./map-street.js";

export class Edge {
  /**
   * @param {string} from
   * @param {string} to
   * @param {Street}       segment
   * @param {number}       distance  Meters
   * @param {number}       angle     Bearing in degrees
   * @param {string}       cardinal  Cardinal direction label
   */
  constructor(from, to, segment, distance, angle, cardinal) {
    this.from = from;
    this.to = to;
    this.segment = segment;
    this.distance = distance;
    this.angle = angle;
    this.cardinal = cardinal;
  }
  get id() {
    return `${this.from}_${this.to}_${this.segment.id}`;
  }
}
