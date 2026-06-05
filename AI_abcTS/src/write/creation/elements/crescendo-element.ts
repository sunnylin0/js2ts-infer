import { AbsoluteElement } from "../../draw/type-definitions";

class CrescendoElem {
	public type = "CrescendoElem";
	public anchor1: AbsoluteElement | null;
	public anchor2: AbsoluteElement | null;
	public dir: "<" | ">";
	public dynamicHeightAbove?: number;
	public dynamicHeightBelow?: number;
	public pitch: number | undefined;

	constructor(anchor1: AbsoluteElement | null, anchor2: AbsoluteElement | null, dir: "<" | ">", positioning: 'above' | 'below') {
		this.anchor1 = anchor1;
		this.anchor2 = anchor2;
		this.dir = dir;
		if (positioning === 'above')
			this.dynamicHeightAbove = 6;
		else
			this.dynamicHeightBelow = 6;
		this.pitch = undefined;
	}
}

export default CrescendoElem;
