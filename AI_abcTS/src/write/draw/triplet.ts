import sprintf from './sprintf';
import renderText from './text';
import printPath from './print-path';
import roundNumber from "./round-number";
import { Renderer } from "./type-definitions";

function drawTriplet(renderer: Renderer, params: any, selectables: any): SVGElement | null {
	renderer.paper.openGroup({ klass: renderer.controller.classes.generate('triplet ' + params.durationClass), "data-name": "triplet" });
	if (!params.hasBeam) {
		drawBracket(renderer, params.anchor1.x, params.startNote, params.anchor2.x + params.anchor2.w, params.endNote);
	}
	// HACK: adjust the position of "3". It is too high in all cases so we fudge it by subtracting 1 here.
	renderText(renderer, { x: params.xTextPos, y: renderer.calcY(params.yTextPos - 1), text: "" + params.number, type: 'tripletfont', anchor: "middle", centerVertically: true, noClass: true, name: "" + params.number }, true);
	const g = renderer.paper.closeGroup();
	selectables.wrapSvgEl({ el_type: "triplet", startChar: -1, endChar: -1 }, g);
	return g;
}

function drawLine(l: number, t: number, r: number, b: number): string {
	return sprintf("M %f %f L %f %f", roundNumber(l), roundNumber(t), roundNumber(r), roundNumber(b));
}

function drawBracket(renderer: Renderer, x1: number, y1_pitch: number, x2: number, y2_pitch: number): void {
	const y1 = renderer.calcY(y1_pitch);
	const y2 = renderer.calcY(y2_pitch);
	const bracketHeight = 5;

	// Draw vertical lines at the beginning and end
	let pathString = "";
	pathString += drawLine(x1, y1, x1, y1 + bracketHeight);
	pathString += drawLine(x2, y2, x2, y2 + bracketHeight);

	// figure out midpoints to draw the broken line.
	const midX = x1 + (x2 - x1) / 2;
	//var midY = y1 + (y2-y1)/2;
	const gapWidth = 8;
	const slope = (y2 - y1) / (x2 - x1);
	const leftEndX = midX - gapWidth;
	const leftEndY = y1 + (leftEndX - x1) * slope;
	pathString += drawLine(x1, y1, leftEndX, leftEndY);
	const rightStartX = midX + gapWidth;
	const rightStartY = y1 + (rightStartX - x1) * slope;
	pathString += drawLine(rightStartX, rightStartY, x2, y2);
	printPath(renderer, { path: pathString, stroke: (renderer as any).foregroundColor, "data-name": "triplet-bracket" });
}

export default drawTriplet;
