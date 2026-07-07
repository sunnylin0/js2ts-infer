import sprintf from './sprintf';
import printPath from './print-path';
import roundNumber from "./round-number";
function drawGlissando(renderer: Renderer, params, selectables: Selectables): SVGPathElement[] {
  if (!params.anchor1 || !params.anchor2 || !params.anchor1.heads || !params.anchor2.heads || params.anchor1.heads.length === 0 || params.anchor2.heads.length === 0)
    window.console.error("Glissando Element not set.");
  const margin: number = 4;
  const leftY = renderer.calcY(params.anchor1.heads[0].pitch);
  const rightY = renderer.calcY(params.anchor2.heads[0].pitch);
  const leftX = params.anchor1.x + params.anchor1.w / 2;
  const rightX = params.anchor2.x + params.anchor2.w / 2;
  const len: number = lineLength(leftX, leftY, rightX, rightY);
  const marginLeft: number = params.anchor1.w / 2 + margin;
  const marginRight: number = params.anchor2.w / 2 + margin;
  const s: number = slope(leftX, leftY, rightX, rightY);
  const leftYAdj: number = getY(leftY, s, marginLeft);
  const rightYAdj: number = getY(rightY, s, -marginRight);
  const num: number = numSquigglies(len - marginLeft - marginRight);
  const el: SVGPathElement = drawSquiggly(renderer, leftX + marginLeft, leftYAdj, num, s);
  selectables.wrapSvgEl({ el_type: "glissando", startChar: -1, endChar: -1 } as Abcelem, el);
  return [el];
}
function lineLength(leftX, leftY, rightX, rightY): number {
  // The length from notehead center to notehead center.
  const w: number = rightX - leftX;
  const h: number = rightY - leftY;
  return Math.sqrt(w * w + h * h);
}
function slope(leftX, leftY, rightX, rightY): number {
  return (rightY - leftY) / (rightX - leftX);
}
function getY(y: number, slope: number, xOfs: number): number {
  return roundNumber(y + (xOfs) * slope);
}
function numSquigglies(length: number): number {
  const endLen: number = 5; // The width of the end - that is, the non repeating part
  return Math.max(2, Math.floor((length - endLen * 2) / 6));
}
const leftStart: Array<Array<number>> = [[3.5, -4.8]];
const rightArr: Array<Array<number>> = [[1.5, -1], [.3, -.3], [-3.5, 3.8]];
const leftEnd: Array<Array<number>> = [[-1.5, 2]];
const topArr: Array<Array<number>> = [[3, 4], [3, -4]];
const bottomArr: Array<Array<number>> = [[-3, 4], [-3, -4]];
function segment(arr: number[][], slope): string {
  let ret: string = "";
  for (let i: number = 0; i < arr.length; i++) {
    ret += 'l' + arr[i][0] + ' ' + getY(arr[i][1], slope, arr[i][0]);
  }
  return ret;
}
const drawSquiggly = function (renderer, x, y, num, slope): SVGPathElement {
  let p: string = sprintf("M %f %f", x, y);
  p += segment(leftStart, slope);
  let i;
  for (i = 0; i < num; i++) {
    p += segment(topArr, slope);
  }
  p += segment(rightArr, slope);
  for (i = 0; i < num; i++)
    p += segment(bottomArr, slope);
  p += segment(leftEnd, slope) + 'z';
  return printPath(renderer, { path: p, highlight: "stroke", stroke: renderer.foregroundColor, 'class': renderer.controller.classes.generate('decoration'), "data-name": "glissando" });
};
export default drawGlissando;
