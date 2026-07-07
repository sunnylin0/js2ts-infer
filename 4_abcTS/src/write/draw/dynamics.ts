import printSymbol from './print-symbol';
function drawDynamics(renderer: Renderer, params, selectables: Selectables): any[] {
    if (params.pitch === undefined)
        window.console.error("Dynamic Element y-coordinate not set.");
    const scalex: number = 1;
    const scaley: number = 1;
    const el = printSymbol(renderer, params.anchor.x, params.pitch, params.dec, {
        scalex: scalex,
        scaley: scaley,
        klass: renderer.controller.classes.generate('decoration dynamics'),
        fill: renderer.foregroundColor,
        stroke: "none",
        name: "dynamics"
    });
    if (el)
        selectables.wrapSvgEl({ el_type: "dynamicDecoration", startChar: -1, endChar: -1, decoration: params.dec }, el);
    return el ? [el] : [];
}
export default drawDynamics;
