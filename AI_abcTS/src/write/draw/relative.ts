import { Renderer, RelativeElement } from './type-definitions';

import renderText from './text';
import printStem from './print-stem';
import printStaffLine from './staff-line';
import printSymbol from './print-symbol';

function drawRelativeElement(renderer: Renderer, params: RelativeElement, bartop: number): SVGElement | null {
	if (params.pitch === undefined)
		(window.console as any).error(params.type + " Relative Element y-coordinate not set.");

	const y = renderer.calcY(params.pitch);

	switch (params.type) {
		case "symbol":
			if (params.c === null) return null;
			let klass = "symbol";
			if (params.klass) klass += " " + params.klass;
			params.graphelem = printSymbol(renderer, params.x, params.pitch, params.c, {
				scalex: params.scalex,
				scaley: params.scaley,
				klass: (renderer.controller.classes as any).generate(klass),
				name: params.name
			});
			break;
		case "debug":
			params.graphelem = renderText(renderer, { x: params.x, y: renderer.calcY(15), text: "" + params.c, type: "debugfont", klass: (renderer.controller.classes as any).generate('debug-msg'), anchor: 'start', centerVertically: false, dim: params.dim }, false);
			break;
		case "tabNumber":
			let hAnchor = "middle";
			let tabFont = "tabnumberfont";
			let tabClass = 'abcjs-tab-number';
			let localY = y;
			if (params.isGrace) {
				tabFont = "tabgracefont";
				localY += 2.5;
				tabClass = 'tab-grace'
			}
			params.graphelem = renderText(renderer, { x: params.x, y: localY, text: "" + params.c, type: tabFont, klass: (renderer.controller.classes as any).generate(tabClass), anchor: hAnchor, centerVertically: false, dim: params.dim, cursor: 'default' }, false);
			break;
		case "barNumber":
			params.graphelem = renderText(renderer, { x: params.x, y: y, text: "" + params.c, type: "measurefont", klass: (renderer.controller.classes as any).generate('bar-number'), anchor: "middle", dim: params.dim, name: "bar-number" }, true);
			break;
		case "lyric":
			params.graphelem = renderText(renderer, { x: params.x, y: y, text: params.c, type: "vocalfont", klass: (renderer.controller.classes as any).generate('lyric'), anchor: "middle", dim: params.dim, name: "lyric" }, false);
			break;
		case "chord":
			params.graphelem = renderText(renderer, { x: params.x, y: y, text: params.c, type: 'gchordfont', klass: (renderer.controller.classes as any).generate("chord"), anchor: "middle", dim: params.dim, lane: params.getLane ? params.getLane() : undefined, name: "chord" }, false);
			break;
		case "decoration":
			// The +6 is to compensate for the placement of text in svg: to be on the same row as symbols, the y-coord needs to compensate for the center line.
			params.graphelem = renderText(renderer, { x: params.x, y: y + 6, text: params.c, type: 'annotationfont', klass: (renderer.controller.classes as any).generate("annotation"), anchor: params.anchor, centerVertically: true, dim: params.dim }, false);
			break;
		case "text":
			params.graphelem = renderText(renderer, { x: params.x, y: y, text: params.c, type: 'annotationfont', klass: (renderer.controller.classes as any).generate("annotation"), anchor: "start", centerVertically: params.centerVertically, dim: params.dim, lane: params.getLane ? params.getLane() : undefined, name: "annotation" }, false);
			break;
		case "multimeasure-text":
			params.graphelem = renderText(renderer, { x: params.x + (params.w / 2), y: y, text: params.c, type: 'tempofont', klass: (renderer.controller.classes as any).generate("rest"), anchor: "middle", centerVertically: false, dim: params.dim }, false);
			break;
		case "part":
			params.graphelem = renderText(renderer, { x: params.x, y: y, text: params.c, type: 'partsfont', klass: (renderer.controller.classes as any).generate("part"), anchor: "start", dim: params.dim, name: params.c }, true);
			break;
		case "bar":
			const pitch2Bar = params.pitch2 !== undefined ? params.pitch2 : params.pitch;
			params.graphelem = printStem(renderer, params.x, (params.linewidth || 0) + renderer.lineThickness, y, (bartop) ? bartop : renderer.calcY(pitch2Bar), null, "bar"); break;
		case "stem":
			const stemWidth = (params.linewidth || 0) > 0 ? (params.linewidth || 0) + renderer.lineThickness : (params.linewidth || 0) - renderer.lineThickness;
			const pitch2Stem = params.pitch2 !== undefined ? params.pitch2 : params.pitch;
			params.graphelem = printStem(renderer, params.x, stemWidth, y, renderer.calcY(pitch2Stem), 'abcjs-stem', 'stem'); break;
		case "ledger":
			params.graphelem = printStaffLine(renderer, params.x, params.x + params.w, params.pitch, "abcjs-ledger", "ledger", 0.35 + renderer.lineThickness); break;
	}

	if (params.scalex !== 1 && params.scalex !== undefined && params.graphelem) {
		scaleExistingElem(renderer.paper, params.graphelem, params.scalex, params.scaley || 1, params.x, y);
	}
	return params.graphelem || null;
}

function scaleExistingElem(paper: any, elem: SVGElement, scaleX: number, scaleY: number, x: number, y: number) {
	paper.setAttributeOnElement(elem, { style: "transform:scale(" + scaleX + "," + scaleY + ");transform-origin:" + x + "px " + y + "px;" });
}

export default drawRelativeElement;
