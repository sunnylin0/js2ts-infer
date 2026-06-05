import { AbsoluteElement } from "../../draw/type-definitions";

class BeamElem {
	public type = "BeamElem";
	public isflat: boolean;
	public isgrace: boolean;
	public forceup: boolean;
	public forcedown: boolean;
	public elems: AbsoluteElement[] = [];
	public total = 0;
	public average = 6;
	public allrests = true;
	public stemHeight: number;
	public beams: any[] = [];
	public duration: number;
	public hint?: boolean;
	public count?: number;
	public stemsUp?: boolean;
	public min?: number;
	public max?: number;
	public mainNote?: AbsoluteElement;

	constructor(stemHeight: number, type?: string, flat?: boolean, firstElement?: any) {
		this.isflat = !!flat;
		this.isgrace = !!(type && type === "grace");
		this.forceup = !!(this.isgrace || (type && type === "up"));
		this.forcedown = !!(type && type === "down");
		this.elems = [];
		this.total = 0;
		this.average = 6;
		this.allrests = true;
		this.stemHeight = stemHeight;
		this.beams = [];
		if (firstElement && firstElement.duration) {
			this.duration = firstElement.duration;
			if (firstElement.startTriplet) {
				this.duration *= firstElement.tripletMultiplier;
			}
			this.duration = Math.round(this.duration * 1000) / 1000;
		} else
			this.duration = 0;
	}

	public setHint(): void {
		this.hint = true;
	}

	public runningDirection(abcelem: any): void {
		const pitch = abcelem.averagepitch;
		if (pitch === undefined) return;
		this.total = Math.round(this.total + pitch);
		if (!this.count)
			this.count = 0;
		this.count++;
	}

	public add(abselem: AbsoluteElement): void {
		const pitch = abselem.abcelem.averagepitch;
		if (pitch === undefined) return;
		if (!abselem.abcelem.rest)
			this.allrests = false;
		(abselem as any).beam = this;
		this.elems.push(abselem);
		this.total = Math.round(this.total + pitch);
		if (this.min === undefined || abselem.abcelem.minpitch < this.min) {
			this.min = abselem.abcelem.minpitch;
		}
		if (this.max === undefined || abselem.abcelem.maxpitch > this.max) {
			this.max = abselem.abcelem.maxpitch;
		}
	}

	public addBeam(beam: any): void {
		this.beams.push(beam);
	}

	public setStemDirection(): void {
		this.average = calcAverage(this.total, this.count || 0);
		if (this.forceup) {
			this.stemsUp = true;
		} else if (this.forcedown) {
			this.stemsUp = false;
		} else {
			const middleLine = 6;
			this.stemsUp = this.average < middleLine;
		}
		delete this.count;
		this.total = 0;
	}

	public calcDir(): void {
		this.average = calcAverage(this.total, this.elems.length);
		if (this.forceup) {
			this.stemsUp = true;
		} else if (this.forcedown) {
			this.stemsUp = false;
		} else {
			const middleLine = 6;
			this.stemsUp = this.average < middleLine;
		}
		const dir = this.stemsUp ? 'up' : 'down';
		for (let i = 0; i < this.elems.length; i++) {
			for (let j = 0; j < this.elems[i].heads.length; j++) {
				this.elems[i].heads[j].stemDir = dir;
			}
		}
	}
}

function calcAverage(total: number, numElements: number): number {
	if (!numElements)
		return 0;
	return total / numElements;
}

export default BeamElem;
