import printStaffLine from './staff-line';
import { Renderer } from "./type-definitions";

function printStaff(renderer: Renderer, startx: number, endx: number, numLines: number, linePitch: number | undefined, dy: number): number[] {
	let klass: string | undefined = "abcjs-top-line";
	let pitch = 2;
	if (linePitch) {
		pitch = linePitch;
	}
	renderer.paper.openGroup({ prepend: true, klass: (renderer.controller.classes as any).generate("abcjs-staff") });
	// If there is one line, it is the B line. Otherwise, the bottom line is the E line.
	let firstYLine = 0;
	let lastYLine = 0;
	if (numLines === 1) {
		printStaffLine(renderer, startx, endx, 6, klass, undefined, dy + renderer.lineThickness);
		firstYLine = renderer.calcY(10);
		lastYLine = renderer.calcY(2);
	} else {
		for (let i = numLines - 1; i >= 0; i--) {
			const curpitch = (i + 1) * pitch;
			lastYLine = renderer.calcY(curpitch);
			if (firstYLine === 0) {
				firstYLine = lastYLine;
			}
			printStaffLine(renderer, startx, endx, curpitch, klass, undefined, dy + renderer.lineThickness);
			klass = undefined;
		}
	}
	renderer.paper.closeGroup();
	return [firstYLine, lastYLine];
}

export default printStaff;
