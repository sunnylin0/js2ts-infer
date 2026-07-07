import printStaffLine from './staff-line';
function printStaff(renderer: Renderer, startx: number, endx: number, numLines: number, linePitch: any, dy: number): number[] {
    let klass: string = "abcjs-top-line";
    let pitch: number = 2;
    if (linePitch) {
        pitch = linePitch;
    }
    renderer.paper.openGroup({ prepend: true, klass: renderer.controller.classes.generate("abcjs-staff") });
    // If there is one line, it is the B line. Otherwise, the bottom line is the E line.
    let firstYLine: number = 0;
    let lastYLine: number = 0;
    if (numLines === 1) {
        printStaffLine(renderer, startx, endx, 6, klass, undefined, dy + renderer.lineThickness);
        firstYLine = renderer.calcY(10);
        lastYLine = renderer.calcY(2);
    }
    else {
        for (let i: number = numLines - 1; i >= 0; i--) {
            const curpitch: number = (i + 1) * pitch;
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
