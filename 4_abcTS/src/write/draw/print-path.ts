function printPath(renderer: Renderer, attrs: any): SVGPathElement {
    const ret: SVGPathElement = renderer.paper.path(attrs);
    return ret;
}
export default printPath;
