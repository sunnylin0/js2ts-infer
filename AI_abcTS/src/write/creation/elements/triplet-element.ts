import { RelativeElement } from "../../draw/type-definitions";

class TripletElem {
	public type = "TripletElem";
	public anchor1: RelativeElement;
	public anchor2: RelativeElement | undefined;
	public number: number;
	public durationClass: string;
	public middleElems: RelativeElement[] = [];
	public flatBeams: boolean;
	public endingHeightAbove?: number;

	constructor(number: number, anchor1: RelativeElement, options: any = {}) {
		this.anchor1 = anchor1;
		this.number = number;
		const duration = (anchor1 as any).parent ? (anchor1 as any).parent.durationClass : 1;
		this.durationClass = ('d' + (Math.round(duration * 1000) / 1000)).replace(/\./, '-');
		this.middleElems = [];
		this.flatBeams = options.flatBeams;
	}

	public isClosed(): boolean {
		return !!this.anchor2;
	}

	public middleNote(elem: RelativeElement): void {
		this.middleElems.push(elem);
	}

	public setCloseAnchor(anchor2: RelativeElement): void {
		this.anchor2 = anchor2;
		const parent = (this.anchor1 as any).parent;
		if (!parent || !parent.beam || (this.anchor1 as any).stemDir === 'up')
			this.endingHeightAbove = 4;
	}
}

export default TripletElem;
