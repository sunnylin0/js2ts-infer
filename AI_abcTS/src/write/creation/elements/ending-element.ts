import { AbsoluteElement } from "../../draw/type-definitions";

class EndingElem {
	public type = "EndingElem";
	public text: string;
	public anchor1: AbsoluteElement | null;
	public anchor2: AbsoluteElement | null;
	public endingHeightAbove = 5;
	public pitch: number | undefined;

	constructor(text: string, anchor1: AbsoluteElement | null, anchor2: AbsoluteElement | null) {
		this.text = text;
		this.anchor1 = anchor1;
		this.anchor2 = anchor2;
		this.endingHeightAbove = 5;
		this.pitch = undefined;
	}
}

export default EndingElem;
