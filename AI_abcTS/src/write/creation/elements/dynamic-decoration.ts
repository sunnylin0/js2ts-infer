import { AbsoluteElement } from "../../draw/type-definitions";

class DynamicDecoration {
	public type = "DynamicDecoration";
	public anchor: AbsoluteElement;
	public dec: string;
	public volumeHeightBelow?: number;
	public volumeHeightAbove?: number;
	public pitch: number | undefined;

	constructor(anchor: AbsoluteElement, dec: string, position: 'above' | 'below') {
		this.anchor = anchor;
		this.dec = dec;
		if (position === 'below')
			this.volumeHeightBelow = 6;
		else
			this.volumeHeightAbove = 6;
		this.pitch = undefined;
	}
}

export default DynamicDecoration;
