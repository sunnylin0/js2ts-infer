import sprintf from './sprintf';
import printPath from './print-path';
import roundNumber from "./round-number";
import { Renderer } from "./type-definitions";

function drawCrescendo(renderer: Renderer, params: any, selectables: any): SVGElement[] {
	if (params.pitch === undefined)
		window.console.error("Crescendo Element y-coordinate not set.");
	const y = renderer.calcY(params.pitch) + 4; // This is the top pixel to use (it is offset a little so that it looks good with the volume marks.)
	const height = 8;

	// TODO-PER: This is just a quick hack to make the dynamic marks not crash if they are mismatched. See the slur treatment for the way to get the beginning and end.
	const left = params.anchor1 ? params.anchor1.x : 0;
	const right = params.anchor2 ? params.anchor2.x : 800;

	let el: SVGElement;
	if (params.dir === "<") {
		el = drawCurveLine(renderer, y + height / 2, y, y + height / 2, y + height, left, right);
	} else {
		el = drawCurveLine(renderer, y, y + height / 2, y + height, y + height / 2, left, right);
	}
	selectables.wrapSvgEl({ el_type: "dynamicDecoration", startChar: -1, endChar: -1 }, el);
	return [el];
}

const drawCurveLine = function (renderer: Renderer, y1: number, y2: number, y3: number, y4: number, left: number, right: number): SVGElement {
	y1 = roundNumber(y1);
	y2 = roundNumber(y2);
	y3 = roundNumber(y3);
	y4 = roundNumber(y4);
	left = roundNumber(left);
	right = roundNumber(right);

	const pathString = sprintf("M %f %f L %f %f M %f %f L %f %f",
		left, y1, right, y2, left, y3, right, y4);
	return printPath(renderer, { path: pathString, highlight: "stroke", stroke: (renderer as any).foregroundColor, 'class': (renderer as any).controller.classes.generate('dynamics decoration'), "data-name": "dynamics" });
};

export default drawCrescendo;
