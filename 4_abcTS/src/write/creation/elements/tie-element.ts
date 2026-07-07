class TieElem {
    endLimitX: AbsoluteElement;
    startLimitX: AbsoluteElement;
    bottom: number;
    top: number;
    voiceNumber: number;
    stemDir: string;
    anchor2: RelativeElement;
    anchor1: RelativeElement;
    type: string = "TieElem";
    isGrace: boolean = false;
    fixedY: boolean = false;
    dotted: boolean = false;
    internalNotes: RelativeElement[] = [];
    isTie: boolean = false;
    hint: boolean = false;
    above: boolean = false;
    startX: number = 0;
    endX: number = 0;
    startY: number = 0;
    endY: number = 0;

    constructor(options: any = {}) {
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
    }
    addInternalNote(note: RelativeElement): void {
        this.internalNotes.push(note);
    }
    setEndAnchor(anchor2: RelativeElement): void {
        this.anchor2 = anchor2;
        if (this.anchor1) {
            this.top = Math.max(this.anchor1.pitch, this.anchor2.pitch) + 4;
            this.bottom = Math.min(this.anchor1.pitch, this.anchor2.pitch) - 4;
        }
        else {
            this.top = this.anchor2.pitch + 4;
            this.bottom = this.anchor2.pitch - 4;
        }
    }
    setStartX(startLimitElem: AbsoluteElement): void {
        this.startLimitX = startLimitElem;
    }
    setEndX(endLimitElem: AbsoluteElement): void {
        this.endLimitX = endLimitElem;
    }
    setHint(): void {
        this.hint = true;
    }
    calcTieDirection(): void {
        if (this.isGrace)
            this.above = false;
        else if (this.voiceNumber === 0)
            this.above = true;
        else if (this.voiceNumber && this.voiceNumber > 0)
            this.above = false;
        else {
            let referencePitch;
            if (this.anchor1)
                referencePitch = this.anchor1.pitch;
            else if (this.anchor2)
                referencePitch = this.anchor2.pitch;
            else
                referencePitch = 14;
            const a1: RelativeElement = this.anchor1;
            const a2: RelativeElement = this.anchor2;
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
    calcSlurDirection(): void {
        if (this.isGrace)
            this.above = false;
        else if (this.voiceNumber === 0)
            this.above = true;
        else if (this.voiceNumber && this.voiceNumber > 0)
            this.above = false;
        else {
            let hasDownStem: boolean = false;
            const a1: RelativeElement = this.anchor1;
            const a2: RelativeElement = this.anchor2;
            if (a1 && a1.stemDir === "down")
                hasDownStem = true;
            if (a2 && a2.stemDir === "down")
                hasDownStem = true;
            for (let i: number = 0; i < this.internalNotes.length; i++) {
                const n: RelativeElement = this.internalNotes[i];
                if (n.stemDir === "down")
                    hasDownStem = true;
            }
            this.above = hasDownStem;
        }
    }
    calcX(lineStartX: number, lineEndX: number): void {
        if (this.anchor1) {
            this.startX = this.anchor1.x;
            if (this.anchor1.scalex < 1)
                this.startX -= 3;
        }
        else if (this.startLimitX)
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
    calcTieY(): void {
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
    calcSlurY(): void {
        const a1: RelativeElement = this.anchor1;
        const a2: RelativeElement = this.anchor2;
        if (a1 && a2) {
            if (this.above && a1.stemDir === "up" && !this.fixedY) {
                this.startY = (a1.highestVert + a1.pitch) / 2;
                this.startX += a1.w / 2;
            }
            else
                this.startY = a1.pitch;
            const beamInterferes: boolean = a2.parent.beam && a2.parent.beam.stemsUp && a2.parent.beam.elems[0] !== a2.parent;
            const midPoint: number = (a2.highestVert + a2.pitch) / 2;
            if (this.above && a2.stemDir === "up" && !this.fixedY && !beamInterferes && (midPoint < this.startY)) {
                this.endY = midPoint;
                this.endX += Math.round(a2.w / 2);
            }
            else
                this.endY = this.above && beamInterferes ? a2.highestVert : a2.pitch;
            if (a1.scalex === 1) {
                const hasBeam1: boolean = !!a1.parent.beam;
                const hasBeam2: boolean = !!a2.parent.beam;
                if (hasBeam1) {
                    const isLastInBeam: boolean = a1.parent === a1.parent.beam.elems[a1.parent.beam.elems.length - 1];
                    if (!isLastInBeam) {
                        if (this.above)
                            this.startY = a1.parent.fixed.t;
                        else
                            this.startY = a1.parent.fixed.b;
                    }
                }
                if (hasBeam2) {
                    const isFirstInBeam: boolean = a2.parent === a2.parent.beam.elems[0];
                    if (!isFirstInBeam) {
                        if (this.above)
                            this.endY = a2.parent.fixed.t;
                        else
                            this.endY = a2.parent.fixed.b;
                    }
                }
            }
        }
        else if (a1) {
            this.startY = this.endY = a1.pitch;
        }
        else if (a2) {
            this.startY = this.endY = a2.pitch;
        }
        else {
            this.startY = this.above ? 14 : 0;
            this.endY = this.above ? 14 : 0;
        }
    }
    avoidCollisionAbove(): void {
        if (this.above) {
            let maxInnerHeight: number = -50;
            for (let i: number = 0; i < this.internalNotes.length; i++) {
                const n: RelativeElement = this.internalNotes[i];
                if (n.highestVert > maxInnerHeight)
                    maxInnerHeight = n.highestVert;
            }
            if (maxInnerHeight > this.startY && maxInnerHeight > this.endY)
                this.startY = this.endY = maxInnerHeight - 1;
        }
    }
    getYBounds(): any[] {
        const lineStartX: number = 10;
        const lineEndX: number = 1000;
        if (this.isTie) {
            this.calcTieDirection();
            this.calcX(lineStartX, lineEndX);
            this.calcTieY();
        }
        else {
            this.calcSlurDirection();
            this.calcX(lineStartX, lineEndX);
            this.calcSlurY();
        }
        let top;
        let bottom;
        if (this.above) {
            bottom = Math.min(this.startY, this.endY);
            top = bottom + 3;
        }
        else {
            top = Math.min(this.startY, this.endY);
            bottom = top - 3;
        }
        return [top, bottom];
    }
}
export default TieElem;
