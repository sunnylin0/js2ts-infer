import printPath from './print-path';
import roundNumber from "./round-number";
import { Renderer } from "./type-definitions";

function drawBeam(renderer: Renderer, params: any, selectables?: any): SVGElement[] | undefined {
	if (params.beams.length === 0) return;

	let pathString = "";
	for (let i = 0; i < params.beams.length; i++) {
		const beam = params.beams[i];
		if (beam.split) {
			const slope = getSlope(renderer, beam.startX, beam.startY, beam.endX, beam.endY);
			const xes: number[][] = [];
			for (let j = 0; j < beam.split.length; j += 2) {
				xes.push([beam.split[j], beam.split[j + 1]]);
			}
			for (let j = 0; j < xes.length; j++) {
				const y1 = getY(beam.startX, beam.startY, slope, xes[j][0]);
				const y2 = getY(beam.startX, beam.startY, slope, xes[j][1]);
				pathString += drawSingleBeam(renderer, xes[j][0], y1, xes[j][1], y2, beam.dy);
			}
		} else
			pathString += drawSingleBeam(renderer, beam.startX, beam.startY, beam.endX, beam.endY, beam.dy);
	}
	const durationClass = ("abcjs-d" + params.duration).replace(/\./g, "-");
	const klasses = renderer.controller.classes.generate('beam-elem ' + durationClass);
	const el = printPath(renderer, {
		path: pathString,
		stroke: "none",
		fill: (renderer as any).foregroundColor,
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
	const startY2 = roundNumber(startY + dy);
	const endY2 = roundNumber(endY + dy);
	return "M" + startX + " " + startY + " L" + endX + " " + endY +
		"L" + endX + " " + endY2 + " L" + startX + " " + startY2 + "z";
}

function getSlope(renderer: Renderer, startX: number, startY: number, endX: number, endY: number): number {
	return (endY - startY) / (endX - startX);
}

function getY(startX: number, startY: number, slope: number, currentX: number): number {
	const x = currentX - startX;
	return startY + x * slope;
}

export default drawBeam;
