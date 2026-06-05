import printSymbol from './print-symbol';
import { Renderer } from "./type-definitions";

function drawDynamics(renderer: Renderer, params: any, selectables: any): SVGElement[] {
	if (params.pitch === undefined)
		window.console.error("Dynamic Element y-coordinate not set.");
	const scalex = 1;
	const scaley = 1;
	const el = printSymbol(renderer, params.anchor.x, params.pitch, params.dec, {
		scalex: scalex,
		scaley: scaley,
		klass: (renderer as any).controller.classes.generate('decoration dynamics'),
		fill: (renderer as any).foregroundColor,
		stroke: "none",
		name: "dynamics"
	});
	if (el) selectables.wrapSvgEl({ el_type: "dynamicDecoration", startChar: -1, endChar: -1, decoration: params.dec }, el);
	return el ? [el] : [];
}

export default drawDynamics;
