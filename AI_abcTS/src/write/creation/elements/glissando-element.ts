import { AbsoluteElement } from "../../draw/type-definitions";

class GlissandoElem {
	public type = "GlissandoElem";
	public anchor1: AbsoluteElement | null;
	public anchor2: AbsoluteElement | null;

	constructor(anchor1: AbsoluteElement | null, anchor2: AbsoluteElement | null) {
		this.anchor1 = anchor1;
		this.anchor2 = anchor2;
	}
}

export default GlissandoElem;
