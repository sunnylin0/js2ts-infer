import { Renderer } from "./type-definitions";

function drawSeparator(renderer: Renderer, width: number): void {
	const fill = "rgba(0,0,0,255)";
	const stroke = "rgba(0,0,0,0)";
	const y = Math.round(renderer.y);
	const staffWidth = (renderer as any).controller.width;
	const x1 = (staffWidth - width) / 2;
	const x2 = x1 + width;
	const pathString = 'M ' + x1 + ' ' + y +
		' L ' + x2 + ' ' + y +
		' L ' + x2 + ' ' + (y + 1) +
		' L ' + x1 + ' ' + (y + 1) +
		' L ' + x1 + ' ' + y + ' z';
	(renderer.paper as any).pathToBack({ path: pathString, stroke: stroke, fill: fill, 'class': (renderer.controller.classes as any).generate('defined-text') });
}

export default drawSeparator;
