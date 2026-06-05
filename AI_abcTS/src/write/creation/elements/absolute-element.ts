import highlight from "../../interactive/highlight";
import unhighlight from "../../interactive/unhighlight";

interface FixedCoords {
	w: number;
	t: number | undefined;
	b: number | undefined;
}

interface SpecialY {
	tempoHeightAbove: number;
	partHeightAbove: number;
	volumeHeightAbove: number;
	dynamicHeightAbove: number;
	endingHeightAbove: number;
	chordHeightAbove: number;
	lyricHeightAbove: number;
	lyricHeightBelow: number;
	chordHeightBelow: number;
	volumeHeightBelow: number;
	dynamicHeightBelow: number;
	[key: string]: number;
}

class AbsoluteElement {
	public tuneNumber: number;
	public abcelem: any;
	public duration: number;
	public durationClass: number;
	public minspacing: number;
	public x = 0;
	public children: any[] = [];
	public heads: any[] = [];
	public extra: any[] = [];
	public extraw = 0;
	public w = 0;
	public right: any[] = [];
	public invisible = false;
	public bottom: number | undefined;
	public top: number | undefined;
	public type: string;
	public hint?: boolean;
	public elemset: SVGElement[] = [];

	public fixed: FixedCoords = { w: 0, t: undefined, b: undefined };
	public specialY: SpecialY = {
		tempoHeightAbove: 0,
		partHeightAbove: 0,
		volumeHeightAbove: 0,
		dynamicHeightAbove: 0,
		endingHeightAbove: 0,
		chordHeightAbove: 0,
		lyricHeightAbove: 0,
		lyricHeightBelow: 0,
		chordHeightBelow: 0,
		volumeHeightBelow: 0,
		dynamicHeightBelow: 0
	};

	constructor(abcelem: any, duration: number, minspacing: number, type: string, tuneNumber: number, options: any = {}) {
		this.tuneNumber = tuneNumber;
		this.abcelem = abcelem;
		this.duration = duration;
		this.durationClass = options.durationClassOveride !== undefined ? options.durationClassOveride : this.duration;
		this.minspacing = minspacing || 0;
		this.type = type;
	}

	public getFixedCoords(): { x: number, w: number, t: number | undefined, b: number | undefined } {
		return { x: this.x, w: this.fixed.w, t: this.fixed.t, b: this.fixed.b };
	}

	public addExtra(extra: any): void {
		this.fixed.w = Math.max(this.fixed.w, extra.dx + extra.w);
		if (this.fixed.t === undefined) this.fixed.t = extra.top; else this.fixed.t = Math.max(this.fixed.t, extra.top);
		if (this.fixed.b === undefined) this.fixed.b = extra.bottom; else this.fixed.b = Math.min(this.fixed.b, extra.bottom);
		if (extra.dx < this.extraw) this.extraw = extra.dx;
		this.extra.push(extra);
		this._addChild(extra);
	}

	public addHead(head: any): void {
		if (head.dx < this.extraw) this.extraw = head.dx;
		this.heads.push(head);
		this.addRight(head);
	}

	public addRight(right: any): void {
		this.fixed.w = Math.max(this.fixed.w, right.dx + right.w);
		if (right.top !== undefined) {
			if (this.fixed.t === undefined) this.fixed.t = right.top; else this.fixed.t = Math.max(this.fixed.t, right.top);
		}
		if (right.bottom !== undefined) {
			if (this.fixed.b === undefined) this.fixed.b = right.bottom; else this.fixed.b = Math.min(this.fixed.b, right.bottom);
		}
		if (right.dx + right.w > this.w) this.w = right.dx + right.w;
		this.right.push(right);
		this._addChild(right);
	}

	public addFixed(elem: any): void {
		this._addChild(elem);
	}

	public addFixedX(elem: any): void {
		this._addChild(elem);
	}

	public addCentered(elem: any): void {
		const half = elem.w / 2;
		if (-half < this.extraw) this.extraw = -half;
		this.extra.push(elem);
		if (elem.dx + half > this.w) this.w = elem.dx + half;
		this.right.push(elem);
		this._addChild(elem);
	}

	private setLimit(member: string, child: any): void {
		if (!child[member]) return;
		if (!this.specialY[member])
			this.specialY[member] = child[member];
		else
			this.specialY[member] = Math.max(this.specialY[member], child[member]);
	}

	private _addChild(child: any): void {
		let okToPushTop = true;
		if ((this.abcelem.el_type == "clef") && (child.type == "barNumber")) {
			okToPushTop = false;
		}

		child.parent = this;
		this.children.push(child);

		if (okToPushTop) {
			this.pushTop(child.top);
		}

		this.pushBottom(child.bottom);
		this.setLimit('tempoHeightAbove', child);
		this.setLimit('partHeightAbove', child);
		this.setLimit('volumeHeightAbove', child);
		this.setLimit('dynamicHeightAbove', child);
		this.setLimit('endingHeightAbove', child);
		this.setLimit('chordHeightAbove', child);
		this.setLimit('lyricHeightAbove', child);
		this.setLimit('lyricHeightBelow', child);
		this.setLimit('chordHeightBelow', child);
		this.setLimit('volumeHeightBelow', child);
		this.setLimit('dynamicHeightBelow', child);
	}

	public pushTop(top: number | undefined): void {
		if (top !== undefined) {
			if (this.top === undefined)
				this.top = top;
			else
				this.top = Math.max(top, this.top);
		}
	}

	public pushBottom(bottom: number | undefined): void {
		if (bottom !== undefined) {
			if (this.bottom === undefined)
				this.bottom = bottom;
			else
				this.bottom = Math.min(bottom, this.bottom);
		}
	}

	public setX(x: number): void {
		this.x = x;
		for (let i = 0; i < this.children.length; i++)
			this.children[i].setX(x);
	}

	public center(before: any, after: any): void {
		const midpoint = (after.x - before.x) / 2 + before.x;
		this.x = midpoint - this.w / 2;
		for (let k = 0; k < this.children.length; k++)
			this.children[k].setX(this.x);
	}

	public setHint(): void {
		this.hint = true;
	}

	public highlight(klass: string, color: string): void {
		highlight.bind(this)(klass, color);
	}

	public unhighlight(klass: string, color: string): void {
		unhighlight.bind(this)(klass, color);
	}
}

export default AbsoluteElement;
