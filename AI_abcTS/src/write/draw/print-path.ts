import { Renderer } from "./type-definitions";

function printPath(renderer: Renderer, attrs: any, params?: any): SVGPathElement {
	const ret = renderer.paper.path(attrs);
	return ret;
}

export default printPath;
