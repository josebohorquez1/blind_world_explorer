export class Neighbor {
    /**
     * Constructor to instantiate each neighbor
     * @param {string} originIntersectionId 
     * @param {string} nextIntersectionId 
     * @param {string} wayId 
     * @param {number} angle 
     * @param {number} cardinalDirection 
     * @param {number} distance 
     */
    constructor (originIntersectionId, nextIntersectionId, wayId, angle, cardinalDirection, distance) {
        this.originIntersectionId = originIntersectionId;
        this.nextIntersectionId = nextIntersectionId;
        this.wayId = wayId;
        this.angle = angle;
        this.cardinalDirection = cardinalDirection;
        this.distance = distance;
    }
}
