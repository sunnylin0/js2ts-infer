import printLine from './print-line';
import { Renderer } from "./type-definitions";

function printStaffLine(renderer: Renderer, x1: number, x2: number, pitch: number, klass?: string, name?: string, dy: number = 0): SVGPathElement | SVGLineElement | null {
	const y = renderer.calcY(pitch);
	return printLine(renderer, x1, x2, y, klass, name, dy);
}

export default printStaffLine;

