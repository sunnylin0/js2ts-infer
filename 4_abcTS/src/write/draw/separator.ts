function drawSeparator(renderer: Renderer, width): void {
    const fill: string = "rgba(0,0,0,255)";
    const stroke: string = "rgba(0,0,0,0)";
    const y: number = Math.round(renderer.y);
    const staffWidth: number = renderer.controller.width;
    const x1: number = (staffWidth - width) / 2;
    const x2 = x1 + width;
    const pathString: string = 'M ' + x1 + ' ' + y +
        ' L ' + x2 + ' ' + y +
        ' L ' + x2 + ' ' + (y + 1) +
        ' L ' + x1 + ' ' + (y + 1) +
        ' L ' + x1 + ' ' + y + ' z';
    renderer.paper.pathToBack({ path: pathString, stroke: stroke, fill: fill, 'class': renderer.controller.classes.generate('defined-text') });
}
export default drawSeparator;
