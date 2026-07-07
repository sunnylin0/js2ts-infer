class BeamElem {
    stemsUp: boolean;
    max: number;
    min: number;
    count: number;
    hint: any;
    duration: number;
    stemHeight: number;
    forcedown: boolean;
    forceup: boolean;
    isgrace: boolean;
    isflat: boolean;
    type: string = "BeamElem";
    elems: AbsoluteElement[] = [];
    total: number = 0;
    average: number = 6;
    allrests: boolean = true;
    beams: BeamElem[] = [];

    constructor(stemHeight: number, type: string, flat: boolean, firstElement: any) {
        this.isflat = !!flat;
        this.isgrace = !!(type && type === "grace");
        this.forceup = !!(this.isgrace || (type && type === "up"));
        this.forcedown = !!(type && type === "down");
        this.stemHeight = stemHeight;
        if (firstElement && firstElement.duration) {
            this.duration = firstElement.duration;
            if (firstElement.startTriplet) {
                this.duration *= firstElement.tripletMultiplier;
            }
            this.duration = Math.round(this.duration * 1000) / 1000;
        }
        else
            this.duration = 0;
    }
    setHint(): void {
        this.hint = true;
    }
    runningDirection(abcelem: any): void {
        const pitch: number = abcelem.averagepitch;
        if (pitch === undefined)
            return;
        this.total = Math.round(this.total + pitch);
        if (!this.count)
            this.count = 0;
        this.count++;
    }
    add(abselem: AbsoluteElement): void {
        const pitch: number = abselem.abcelem.averagepitch;
        if (pitch === undefined)
            return;
        if (!abselem.abcelem.rest)
            this.allrests = false;
        abselem.beam = this;
        this.elems.push(abselem);
        this.total = Math.round(this.total + pitch);
        if (this.min === undefined || abselem.abcelem.minpitch < this.min) {
            this.min = abselem.abcelem.minpitch;
        }
        if (this.max === undefined || abselem.abcelem.maxpitch > this.max) {
            this.max = abselem.abcelem.maxpitch;
        }
    }
    addBeam(beam: any): void {
        this.beams.push(beam);
    }
    setStemDirection(): void {
        this.average = calcAverage(this.total, this.count || 0);
        if (this.forceup) {
            this.stemsUp = true;
        }
        else if (this.forcedown) {
            this.stemsUp = false;
        }
        else {
            const middleLine: number = 6;
            this.stemsUp = this.average < middleLine;
        }
        delete this.count;
        this.total = 0;
    }
    calcDir(): void {
        this.average = calcAverage(this.total, this.elems.length);
        if (this.forceup) {
            this.stemsUp = true;
        }
        else if (this.forcedown) {
            this.stemsUp = false;
        }
        else {
            const middleLine: number = 6;
            this.stemsUp = this.average < middleLine;
        }
        const dir: string = this.stemsUp ? 'up' : 'down';
        for (let i: number = 0; i < this.elems.length; i++) {
            for (let j: number = 0; j < this.elems[i].heads.length; j++) {
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
