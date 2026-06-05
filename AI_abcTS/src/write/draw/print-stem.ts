import elementGroup from './group-elements';
import roundNumber from "./round-number";
import { Renderer } from "./type-definitions";

function printStem(renderer: Renderer, x: number, dx: number, y1: number, y2: number, klass?: string, name?: string): SVGPathElement | SVGLineElement | null {
	if (dx < 0 || y1 < y2) { // correct path "handedness" for intersection with other elements
		const tmp = roundNumber(y2);
		y2 = roundNumber(y1);
		y1 = tmp;
	} else {
		y1 = roundNumber(y1);
		y2 = roundNumber(y2);
	}
	x = roundNumber(x);
	const x2 = roundNumber(x + dx);
	// TODO-PER: This fixes a firefox bug where it isn't displayed
	if ((renderer as any).firefox112) {
		x += dx / 2; // Because the x coordinate is the edge of where the line goes but the width widens from the middle.
		const attr: any = {
			x1: x,
			x2: x,
			y1: y1,
			y2: y2,
			stroke: (renderer as any).foregroundColor,
			'stroke-width': Math.abs(dx)
		}
		if (klass)
			attr['class'] = klass;
		if (name)
			attr['data-name'] = name;

		return (renderer.paper as any).lineToBack(attr);
	}
	const pathArray = [["M", x, y1], ["L", x, y2], ["L", x2, y2], ["L", x2, y1], ["z"]];
	const attr: any = { path: "" };
	for (let i = 0; i < pathArray.length; i++)
		attr.path += pathArray[i].join(" ") + " ";
	attr.path = attr.path.trim();

	if (klass)
		attr['class'] = klass;
	if (name)
		attr['data-name'] = name;
	if (!(elementGroup as any).isInGroup()) {
		attr.stroke = "none";
		attr.fill = (renderer as any).foregroundColor;
	}
	return (renderer.paper as any).pathToBack(attr);
}

export default printStem;
