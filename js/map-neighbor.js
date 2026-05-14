export class Neighbor {
    /**
     * Constructor to instantiate each neighbor
     * @param {string} currentIntersectionId 
     * @param {string} nextIntersectionId 
     * @param {string} wayId 
     * @param {number} angle 
     * @param {number} cardinalDirection 
     * @param {number} distance 
     */
    constructor (currentIntersectionId, nextIntersectionId, wayId, angle, cardinalDirection, distance) {
        this.currentIntersectionId = currentIntersectionId;
        this.nextIntersectionId = nextIntersectionId;
        this.wayId = wayId;
        this.angle = angle;
        this.cardinalDirection = cardinalDirection;
        this.distance = distance;
    }
}
