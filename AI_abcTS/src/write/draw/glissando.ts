import sprintf from './sprintf';
import printPath from './print-path';
import roundNumber from "./round-number";
import { Renderer } from "./type-definitions";

function drawGlissando(renderer: Renderer, params: any, selectables: any): SVGElement[] {
	if (!params.anchor1 || !params.anchor2 || !params.anchor1.heads || !params.anchor2.heads || params.anchor1.heads.length === 0 || params.anchor2.heads.length === 0)
		window.console.error("Glissando Element not set.");

	const margin = 4;
	const leftY = renderer.calcY(params.anchor1.heads[0].pitch)
	const rightY = renderer.calcY(params.anchor2.heads[0].pitch)
	const leftX = params.anchor1.x + params.anchor1.w / 2
	const rightX = params.anchor2.x + params.anchor2.w / 2

	const len = lineLength(leftX, leftY, rightX, rightY)
	const marginLeft = params.anchor1.w / 2 + margin
	const marginRight = params.anchor2.w / 2 + margin
	const s = slope(leftX, leftY, rightX, rightY)
	const leftYAdj = getY(leftY, s, marginLeft)
	const rightYAdj = getY(rightY, s, -marginRight)
	const num = numSquigglies(len - marginLeft - marginRight)

	const el = drawSquiggly(renderer, leftX + marginLeft, leftYAdj, num, s)
	selectables.wrapSvgEl({ el_type: "glissando", startChar: -1, endChar: -1 }, el);
	return [el];
}

function lineLength(leftX: number, leftY: number, rightX: number, rightY: number): number {
	// The length from notehead center to notehead center.
	const w = rightX - leftX
	const h = rightY - leftY
	return Math.sqrt(w * w + h * h)
}

function slope(leftX: number, leftY: number, rightX: number, rightY: number): number {
	return (rightY - leftY) / (rightX - leftX)
}

function getY(y: number, slope: number, xOfs: number): number {
	return roundNumber(y + (xOfs) * slope);
}

function numSquigglies(length: number): number {
	const endLen = 5; // The width of the end - that is, the non repeating part
	return Math.max(2, Math.floor((length - endLen * 2) / 6));
}

const leftStart = [[3.5, -4.8]]
const rightArr = [[1.5, -1], [.3, -.3], [-3.5, 3.8]]
const leftEnd = [[-1.5, 2]]
const topArr = [[3, 4], [3, -4]]
const bottomArr = [[-3, 4], [-3, -4]]

function segment(arr: number[][], slope: number): string {
	let ret = "";
	for (let i = 0; i < arr.length; i++) {
		ret += 'l' + arr[i][0] + ' ' + getY(arr[i][1], slope, arr[i][0])
	}
	return ret
}

const drawSquiggly = function (renderer: Renderer, x: number, y: number, num: number, slope: number): SVGElement {
	let p = sprintf("M %f %f", x, y);
	p += segment(leftStart, slope)
	let i: number;
	for (i = 0; i < num; i++) {
		p += segment(topArr, slope)
	}
	p += segment(rightArr, slope)
	for (i = 0; i < num; i++)
		p += segment(bottomArr, slope)
	p += segment(leftEnd, slope) + 'z'
	return printPath(renderer, { path: p, highlight: "stroke", stroke: (renderer as any).foregroundColor, 'class': (renderer as any).controller.classes.generate('decoration'), "data-name": "glissando" });
}

export default drawGlissando;
