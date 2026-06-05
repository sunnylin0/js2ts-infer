import sprintf from './sprintf';
import roundNumber from './round-number';
import printStem from './print-stem';
import { Renderer } from "./type-definitions";

class TabLine {
	private renderer: Renderer;
	private dx: number;
	private klass?: string;
	private name?: string;
	private options: any;

	constructor(renderer: Renderer, klass?: string, dx: number = 0.35, name?: string) {
		this.renderer = renderer;
		this.dx = dx;
		this.klass = klass;
		this.name = name;
		const fill = (renderer as any).foregroundColor;
		this.options = { stroke: "none", fill: fill };
		if (name)
			this.options['data-name'] = name;
		if (klass)
			this.options['class'] = klass;
	}

	public printVertical(y1: number, y2: number, x: number): SVGPathElement | null {
		return printStem(this.renderer,
			x,
			this.dx,
			y1,
			y2,
			this.options.klass,
			this.options.name);
	}

	public printHorizontal(x1: number, x2: number, y: number): SVGPathElement | null {
		x1 = roundNumber(x1);
		x2 = roundNumber(x2);
		const y1 = roundNumber(y - this.dx);
		const y2 = roundNumber(y + this.dx);
		this.options.path = sprintf("M %f %f L %f %f L %f %f L %f %f z", x1, y1, x2, y1,
			x2, y2, x1, y2);
		return (this.renderer.paper as any).pathToBack(this.options);
	}
}

export default TabLine;

