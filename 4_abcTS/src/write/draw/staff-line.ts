import printLine from './print-line';
function printStaffLine(renderer: Renderer, x1: number, x2: number, pitch: number, klass: string, name: string, dy: number = 0): SVGPathElement {
    const y: number = renderer.calcY(pitch);
    return printLine(renderer, x1, x2, y, klass, name, dy);
}
export default printStaffLine;
