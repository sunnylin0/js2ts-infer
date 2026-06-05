import sprintf from './sprintf';
import roundNumber from "./round-number";
import { Renderer } from "./type-definitions";

function printLine(renderer: Renderer, x1: number, x2: number, y: number, klass?: string, name?: string, dy: number = 0): SVGPathElement | SVGLineElement | null {
	const fill = (renderer as any).foregroundColor;
	x1 = roundNumber(x1);
	x2 = roundNumber(x2);
	const y1 = roundNumber(y - dy);
	const y2 = roundNumber(y + dy);
	// TODO-PER: This fixes a firefox bug where it isn't displayed
	if ((renderer as any).firefox112) {
		y += dy / 2; // Because the y coordinate is the edge of where the line goes but the width widens from the middle.
		const attr: any = {
			x1: x1,
			x2: x2,
			y1: y,
			y2: y,
			stroke: (renderer as any).foregroundColor,
			'stroke-width': Math.abs(dy * 2)
		}
		if (klass)
			attr['class'] = klass;
		if (name)
			attr['data-name'] = name;

		return (renderer.paper as any).lineToBack(attr);
	}

	const pathString = sprintf("M %f %f L %f %f L %f %f L %f %f z", x1, y1, x2, y1,
		x2, y2, x1, y2);
	const options: any = { path: pathString, stroke: "none", fill: fill };
	if (name)
		options['data-name'] = name;
	if (klass)
		options['class'] = klass;
	const ret = (renderer.paper as any).pathToBack(options);

	return ret;
}

export default printLine;

