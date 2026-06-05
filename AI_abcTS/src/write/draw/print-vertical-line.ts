import sprintf from "./sprintf";
import { Renderer } from "./type-definitions";

function printVerticalLine(renderer: Renderer, x: number, y1: number, y2: number): void {
	const dy = 0.35;
	const fill = "#00aaaa";
	let pathString = sprintf("M %f %f L %f %f L %f %f L %f %f z", x - dy, y1, x - dy, y2,
		x + dy, y1, x + dy, y2);
	(renderer.paper as any).pathToBack({ path: pathString, stroke: "none", fill: fill, 'class': renderer.controller.classes.generate('staff') });
	pathString = sprintf("M %f %f L %f %f L %f %f L %f %f z", x - 20, y1, x - 20, y1 + 3,
		x, y1, x, y1 + 3);
	(renderer.paper as any).pathToBack({ path: pathString, stroke: "none", fill: fill, 'class': renderer.controller.classes.generate('staff') });
	pathString = sprintf("M %f %f L %f %f L %f %f L %f %f z", x + 20, y2, x + 20, y2 + 3,
		x, y2, x, y2 + 3);
	(renderer.paper as any).pathToBack({ path: pathString, stroke: "none", fill: fill, 'class': renderer.controller.classes.generate('staff') });

}

export default printVerticalLine;
