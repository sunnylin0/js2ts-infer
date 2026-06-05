import highlight from '../interactive/highlight';
import unhighlight from '../interactive/unhighlight';
import { Paper, AbsoluteElement, StaffPos } from "./type-definitions";

class Selectables {
	private elements: any[] = [];
	private paper: Paper;
	private tuneNumber: number;
	private selectTypes: any;

	constructor(paper: Paper, selectTypes: any, tuneNumber: number) {
		this.paper = paper;
		this.tuneNumber = tuneNumber;
		this.selectTypes = selectTypes;
	}

	public getElements(): any[] {
		return this.elements;
	}

	public add(absEl: any, svgEl: SVGElement, isNoteOrTabNumber: boolean, staffPos?: StaffPos): void {
		if (!this.canSelect(absEl))
			return;
		let params: any;
		if (this.selectTypes === undefined)
			params = { selectable: false, "data-index": this.elements.length }; // This is the old behavior.
		else
			params = { selectable: true, tabindex: 0, "data-index": this.elements.length };
		this.paper.setAttributeOnElement(svgEl, params);
		const sel: any = { absEl: absEl, svgEl: svgEl, isDraggable: isNoteOrTabNumber };
		if (staffPos !== undefined)
			sel.staffPos = staffPos;
		this.elements.push(sel);
	}

	public canSelect(absEl: any): boolean {
		if (this.selectTypes === false)
			return false;
		if (!absEl || !absEl.abcelem)
			return false;
		if (this.selectTypes === true)
			return true;
		if (this.selectTypes === undefined) {
			// by default, only notes and tab numbers can be clicked.
			if (absEl.abcelem.el_type === 'note' || absEl.abcelem.el_type === 'tabNumber') {
				return true;
			}
			return false;
		}
		return this.selectTypes.indexOf(absEl.abcelem.el_type) >= 0;
	}

	public wrapSvgEl(abcelem: any, el: SVGElement): void {
		const absEl: any = {
			tuneNumber: this.tuneNumber,
			abcelem: abcelem,
			elemset: [el],
			highlight: highlight,
			unhighlight: unhighlight
		};
		this.add(absEl, el, false);
	}
}

export default Selectables;
