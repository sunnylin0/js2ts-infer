import printPath from './print-path';
import roundNumber from "./round-number";
function drawBeam(renderer: Renderer, params: BeamElem, selectables: Selectables): SVGPathElement[] {
    if (params.beams.length === 0)
        return;
    let pathString: string = "";
    for (let i: number = 0; i < params.beams.length; i++) {
        const beam: BeamElem = params.beams[i];
        if (beam.split) {
            const slope: number = getSlope(renderer, beam.startX, beam.startY, beam.endX, beam.endY);
            const xes = [];
            for (let j: number = 0; j < beam.split.length; j += 2) {
                xes.push([beam.split[j], beam.split[j + 1]]);
            }
            for (let j: number = 0; j < xes.length; j++) {
                const y1 = getY(beam.startX, beam.startY, slope, xes[j][0]);
                const y2 = getY(beam.startX, beam.startY, slope, xes[j][1]);
                pathString += drawSingleBeam(renderer, xes[j][0], y1, xes[j][1], y2, beam.dy);
            }
        }
        else
            pathString += drawSingleBeam(renderer, beam.startX, beam.startY, beam.endX, beam.endY, beam.dy);
    }
    const durationClass: string = ("abcjs-d" + params.duration).replace(/\./g, "-");
    const klasses: string = renderer.controller.classes.generate('beam-elem ' + durationClass);
    const el: SVGPathElement = printPath(renderer, {
        path: pathString,
        stroke: "none",
        fill: renderer.foregroundColor,
        'class': klasses
    });
    return [el];
}
function drawSingleBeam(renderer: Renderer, startX: number, startY: number, endX: number, endY: number, dy: number): string {
    // the X coordinates are actual coordinates, but the Y coordinates are in pitches.
    startY = roundNumber(renderer.calcY(startY));
    endY = roundNumber(renderer.calcY(endY));
    startX = roundNumber(startX);
    endX = roundNumber(endX);
    const startY2: number = roundNumber(startY + dy);
    const endY2: number = roundNumber(endY + dy);
    return "M" + startX + " " + startY + " L" + endX + " " + endY +
        "L" + endX + " " + endY2 + " L" + startX + " " + startY2 + "z";
}
function getSlope(renderer: Renderer, startX, startY, endX, endY): number {
    return (endY - startY) / (endX - startX);
}
function getY(startX, startY, slope: number, currentX) {
    const x: number = currentX - startX;
    return startY + x * slope;
}
export default drawBeam;
