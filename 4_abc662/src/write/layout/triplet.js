import getBarYAt from './get-bar-y-at';
const layoutTriplet = function (element) {
    if (element.anchor1 && element.anchor2) {
        element.hasBeam = !!element.anchor1.parent.beam && element.anchor1.parent.beam === element.anchor2.parent.beam;
        const beam = element.anchor1.parent.beam;
        // If hasBeam is true, then the first and last element in the triplet share the same beam.
        // We avoid using the beam for the triplet layout if the beam covers more than just this triplet.
        if (element.hasBeam && (beam.elems[0] !== element.anchor1.parent || beam.elems[beam.elems.length - 1] !== element.anchor2.parent))
            element.hasBeam = false;
        if (element.hasBeam) {
            // With a beam, we only place the tuplet number.
            const left = isAbove(beam) ? element.anchor1.x + element.anchor1.w : element.anchor1.x;
            element.yTextPos = heightAtMidpoint(left, element.anchor2.x, beam);
            element.yTextPos += isAbove(beam) ? 3 : -2; // Margin between beam and number
            element.xTextPos = xAtMidpoint(left, element.anchor2.x);
            element.top = element.yTextPos + 1;
            element.bottom = element.yTextPos - 2;
            if (isAbove(beam))
                element.endingHeightAbove = 4;
        }
        else {
            // Without a beam, draw a bracket (always above).
            element.startNote = Math.max(element.anchor1.parent.top, 9) + 4;
            element.endNote = Math.max(element.anchor2.parent.top, 9) + 4;
            // Stay horizontal if starting or ending on a rest
            if (element.anchor1.parent.type === "rest" && element.anchor2.parent.type !== "rest")
                element.startNote = element.endNote;
            else if (element.anchor2.parent.type === "rest" && element.anchor1.parent.type !== "rest")
                element.endNote = element.startNote;
            // Adjust for tall notes in the middle
            let max = 0;
            for (let i = 0; i < element.middleElems.length; i++) {
                max = Math.max(max, element.middleElems[i].top);
            }
            max += 4;
            if (max > element.startNote || max > element.endNote) {
                element.startNote = max;
                element.endNote = max;
            }
            if (element.flatBeams) {
                element.startNote = Math.max(element.startNote, element.endNote);
                element.endNote = Math.max(element.startNote, element.endNote);
            }
            element.yTextPos = element.startNote + (element.endNote - element.startNote) / 2;
            element.xTextPos = element.anchor1.x + (element.anchor2.x + element.anchor2.w - element.anchor1.x) / 2;
            element.top = element.yTextPos + 1;
        }
    }
    delete element.middleElems;
    delete element.flatBeams;
};
function isAbove(beam) {
    return beam.stemsUp;
}
function heightAtMidpoint(startX, endX, beam) {
    if (beam.beams.length === 0)
        return 0;
    const b = beam.beams[0];
    const midPoint = startX + (endX - startX) / 2;
    return getBarYAt(b.startX, b.startY, b.endX, b.endY, midPoint);
}
function xAtMidpoint(startX, endX) {
    return startX + (endX - startX) / 2;
}
export default layoutTriplet;
