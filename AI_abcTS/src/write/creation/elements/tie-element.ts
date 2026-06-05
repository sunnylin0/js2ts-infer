import { AbsoluteElement, RelativeElement } from "../../draw/type-definitions";

interface TieOptions {
	anchor1?: RelativeElement;
	anchor2?: RelativeElement;
	isGrace?: boolean;
	fixedY?: boolean;
	stemDir?: string;
	voiceNumber?: number;
	style?: any;
	force?: boolean;
	dotted?: boolean;
}

class TieElem {
	public type = "TieElem";
	public anchor1: RelativeElement | undefined;
	public anchor2: RelativeElement | undefined;
	public isGrace = false;
	public fixedY = false;
	public stemDir: string | undefined;
	public voiceNumber: number | undefined;
	public dotted = false;
	public internalNotes: RelativeElement[] = [];
	public isTie = false;
	public hint = false;
	public above = false;
	public startX = 0;
	public endX = 0;
	public startY = 0;
	public endY = 0;
	public startLimitX: any;
	public endLimitX: any;
	public top?: number;
	public bottom?: number;

	constructor(options: TieOptions = {}) {
		this.anchor1 = options.anchor1;
		this.anchor2 = options.anchor2;
		if (options.isGrace)
			this.isGrace = true;
		if (options.fixedY)
			this.fixedY = true;
		if (options.stemDir)
			this.stemDir = options.stemDir;
		if (options.voiceNumber !== undefined)
			this.voiceNumber = options.voiceNumber;
		if (options.style !== undefined)
			this.dotted = true;
		this.internalNotes = [];
	}

	public addInternalNote(note: RelativeElement): void {
		this.internalNotes.push(note);
	}

	public setEndAnchor(anchor2: RelativeElement): void {
		this.anchor2 = anchor2;
		if (this.anchor1) {
			this.top = Math.max(this.anchor1.pitch, this.anchor2.pitch) + 4;
			this.bottom = Math.min(this.anchor1.pitch, this.anchor2.pitch) - 4;
		} else {
			this.top = this.anchor2.pitch + 4;
			this.bottom = this.anchor2.pitch - 4;
		}
	}

	public setStartX(startLimitElem: any): void {
		this.startLimitX = startLimitElem;
	}

	public setEndX(endLimitElem: any): void {
		this.endLimitX = endLimitElem;
	}

	public setHint(): void {
		this.hint = true;
	}

	public calcTieDirection(): void {
		if (this.isGrace)
			this.above = false;
		else if (this.voiceNumber === 0)
			this.above = true;
		else if (this.voiceNumber && this.voiceNumber > 0)
			this.above = false;
		else {
			let referencePitch: number;
			if (this.anchor1)
				referencePitch = this.anchor1.pitch;
			else if (this.anchor2)
				referencePitch = this.anchor2.pitch;
			else
				referencePitch = 14;

			const a1 = this.anchor1 as any;
			const a2 = this.anchor2 as any;
			if ((a1 && a1.stemDir === 'down') && (a2 && a2.stemDir === "down"))
				this.above = true;
			else if ((a1 && a1.stemDir === 'up') && (a2 && a2.stemDir === "up"))
				this.above = false;
			else if (a1 && a2)
				this.above = referencePitch >= 6;
			else if (a1)
				this.above = a1.stemDir === "down";
			else if (a2)
				this.above = a2.stemDir === "down";
			else
				this.above = referencePitch >= 6;
		}
	}

	public calcSlurDirection(): void {
		if (this.isGrace)
			this.above = false;
		else if (this.voiceNumber === 0)
			this.above = true;
		else if (this.voiceNumber && this.voiceNumber > 0)
			this.above = false;
		else {
			let hasDownStem = false;
			const a1 = this.anchor1 as any;
			const a2 = this.anchor2 as any;
			if (a1 && a1.stemDir === "down")
				hasDownStem = true;
			if (a2 && a2.stemDir === "down")
				hasDownStem = true;
			for (let i = 0; i < this.internalNotes.length; i++) {
				const n = this.internalNotes[i] as any;
				if (n.stemDir === "down")
					hasDownStem = true;
			}
			this.above = hasDownStem;
		}
	}

	public calcX(lineStartX: number, lineEndX: number): void {
		if (this.anchor1) {
			this.startX = this.anchor1.x;
			if ((this.anchor1 as any).scalex < 1)
				this.startX -= 3;
		} else if (this.startLimitX)
			this.startX = this.startLimitX.x + this.startLimitX.w;
		else {
			if (this.anchor2)
				this.startX = this.anchor2.x - 20;
			else
				this.startX = lineStartX;
		}
		if (!this.anchor1 && this.dotted)
			this.startX -= 3;

		if (this.anchor2)
			this.endX = this.anchor2.x;
		else if (this.endLimitX)
			this.endX = this.endLimitX.x;
		else
			this.endX = lineEndX;
	}

	public calcTieY(): void {
		if (this.anchor1)
			this.startY = this.anchor1.pitch;
		else if (this.anchor2)
			this.startY = this.anchor2.pitch;
		else
			this.startY = this.above ? 14 : 0;

		if (this.anchor2)
			this.endY = this.anchor2.pitch;
		else if (this.anchor1)
			this.endY = this.anchor1.pitch;
		else
			this.endY = this.above ? 14 : 0;
	}

	public calcSlurY(): void {
		const a1 = this.anchor1 as any;
		const a2 = this.anchor2 as any;
		if (a1 && a2) {
			if (this.above && a1.stemDir === "up" && !this.fixedY) {
				this.startY = (a1.highestVert + a1.pitch) / 2;
				this.startX += a1.w / 2;
			} else
				this.startY = a1.pitch;

			const beamInterferes = a2.parent.beam && a2.parent.beam.stemsUp && a2.parent.beam.elems[0] !== a2.parent;
			const midPoint = (a2.highestVert + a2.pitch) / 2;
			if (this.above && a2.stemDir === "up" && !this.fixedY && !beamInterferes && (midPoint < this.startY)) {
				this.endY = midPoint;
				this.endX += Math.round(a2.w / 2);
			} else
				this.endY = this.above && beamInterferes ? a2.highestVert : a2.pitch;

			if (a1.scalex === 1) {
				const hasBeam1 = !!a1.parent.beam;
				const hasBeam2 = !!a2.parent.beam;
				if (hasBeam1) {
					const isLastInBeam = a1.parent === a1.parent.beam.elems[a1.parent.beam.elems.length - 1];
					if (!isLastInBeam) {
						if (this.above)
							this.startY = a1.parent.fixed.t;
						else
							this.startY = a1.parent.fixed.b;
					}
				}

				if (hasBeam2) {
					const isFirstInBeam = a2.parent === a2.parent.beam.elems[0];
					if (!isFirstInBeam) {
						if (this.above)
							this.endY = a2.parent.fixed.t;
						else
							this.endY = a2.parent.fixed.b;
					}
				}
			}
		} else if (a1) {
			this.startY = this.endY = a1.pitch;
		} else if (a2) {
			this.startY = this.endY = a2.pitch;
		} else {
			this.startY = this.above ? 14 : 0;
			this.endY = this.above ? 14 : 0;
		}
	}

	public avoidCollisionAbove(): void {
		if (this.above) {
			let maxInnerHeight = -50;
			for (let i = 0; i < this.internalNotes.length; i++) {
				const n = this.internalNotes[i] as any;
				if (n.highestVert > maxInnerHeight)
					maxInnerHeight = n.highestVert;
			}
			if (maxInnerHeight > this.startY && maxInnerHeight > this.endY)
				this.startY = this.endY = maxInnerHeight - 1;
		}
	}

	public getYBounds(): [number, number] {
		const lineStartX = 10;
		const lineEndX = 1000;
		if (this.isTie) {
			this.calcTieDirection();
			this.calcX(lineStartX, lineEndX);
			this.calcTieY();
		} else {
			this.calcSlurDirection();
			this.calcX(lineStartX, lineEndX);
			this.calcSlurY();
		}
		let top: number;
		let bottom: number;
		if (this.above) {
			bottom = Math.min(this.startY, this.endY);
			top = bottom + 3;
		} else {
			top = Math.min(this.startY, this.endY);
			bottom = top - 3;
		}
		return [top, bottom];
	}
}

export default TieElem;
