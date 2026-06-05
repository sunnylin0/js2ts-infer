import sprintf from './sprintf';
import renderText from './text';
import printPath from './print-path';
import roundNumber from "./round-number";
import { Renderer } from "./type-definitions";

function drawEnding(renderer: Renderer, params: any, linestartx: number, lineendx: number, selectables: any): SVGElement[] {
	if (params.pitch === undefined)
		window.console.error("Ending Element y-coordinate not set.");
	const y = roundNumber(renderer.calcY(params.pitch));
	const height = 20;
	let pathString = '';

	if (params.anchor1) {
		linestartx = roundNumber(params.anchor1.x + params.anchor1.w);
		pathString += sprintf("M %f %f L %f %f ",
			linestartx, y, linestartx, roundNumber(y + height));
	}

	if (params.anchor2) {
		lineendx = roundNumber(params.anchor2.x);
		pathString += sprintf("M %f %f L %f %f ",
			lineendx, y, lineendx, roundNumber(y + height));
	}

	pathString += sprintf("M %f %f L %f %f ",
		linestartx, y, lineendx, y);
	renderer.paper.openGroup({
		klass: (renderer as any).controller.classes.generate("ending"),
		// MAE 17 May 2025 - Ending numbers not being drawn in correct color
		fill: (renderer as any).foregroundColor,
		"data-name": "ending"
	});
	printPath(renderer, {
		path: pathString,
		stroke: (renderer as any).foregroundColor,
		fill: (renderer as any).foregroundColor,
		"data-name": "line"
	});
	if (params.anchor1)
		renderText(renderer, {
			x: roundNumber(linestartx + 5),
			y: roundNumber(renderer.calcY(params.pitch - 0.5)),
			text: params.text,
			type: 'repeatfont',
			klass: 'ending',
			anchor: "start",
			noClass: true,
			name: params.text
		});
	const g = renderer.paper.closeGroup();
	selectables.wrapSvgEl({ el_type: "ending", startChar: -1, endChar: -1 }, g);
	return [g];
}

export default drawEnding;
