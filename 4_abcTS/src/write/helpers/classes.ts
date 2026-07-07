class Classes {
    shouldAddClasses: boolean;
    lineNumber: any = null;
    voiceNumber: any = null;
    measureNumber: any = null;
    measureTotalPerLine: any[] = [];
    noteNumber: any = null;

    constructor(options: any) {
        this.shouldAddClasses = options.shouldAddClasses;
        this.reset();
    }
    reset(): void {
        this.lineNumber = null;
        this.voiceNumber = null;
        this.measureNumber = null;
        this.measureTotalPerLine = [];
        this.noteNumber = null;
    }
    incrLine(): void {
        if (this.lineNumber === null)
            this.lineNumber = 0;
        else
            this.lineNumber++;
        this.voiceNumber = null;
        this.measureNumber = null;
        this.noteNumber = null;
    }
    incrVoice(): void {
        if (this.voiceNumber === null)
            this.voiceNumber = 0;
        else
            this.voiceNumber++;
        this.measureNumber = null;
        this.noteNumber = null;
    }
    isInMeasure(): boolean {
        return this.measureNumber !== null;
    }
    newMeasure(): void {
        if (this.measureNumber !== null && this.lineNumber !== null)
            this.measureTotalPerLine[this.lineNumber] = this.measureNumber;
        this.measureNumber = null;
        this.noteNumber = null;
    }
    startMeasure(): void {
        this.measureNumber = 0;
        this.noteNumber = 0;
    }
    incrMeasure(): void {
        if (this.measureNumber !== null)
            this.measureNumber++;
        this.noteNumber = 0;
    }
    incrNote(): void {
        if (this.noteNumber !== null)
            this.noteNumber++;
    }
    measureTotal(): number {
        let total: number = 0;
        if (this.lineNumber !== null) {
            for (let i: number = 0; i < this.lineNumber; i++)
                total += this.measureTotalPerLine[i] ? this.measureTotalPerLine[i] : 0;
        }
        if (this.measureNumber !== null)
            total += this.measureNumber;
        return total;
    }
    getCurrent(c: any) {
        return {
            line: this.lineNumber,
            measure: this.measureNumber,
            measureTotal: this.measureTotal(),
            voice: this.voiceNumber,
            note: this.noteNumber
        };
    }
    generate(c: string): string {
        if (!this.shouldAddClasses)
            return "";
        let ret = [];
        if (c && c.length > 0)
            ret.push(c);
        if (c === "abcjs-tab-number")
            return ret.join(' ');
        if (c === "text instrument-name")
            return "abcjs-text abcjs-instrument-name";
        if (this.lineNumber !== null)
            ret.push("l" + this.lineNumber);
        if (this.measureNumber !== null) {
            ret.push("m" + this.measureNumber);
            ret.push("mm" + this.measureTotal());
        }
        if (this.voiceNumber !== null)
            ret.push("v" + this.voiceNumber);
        if (c && (c.indexOf('note') >= 0 || c.indexOf('rest') >= 0 || c.indexOf('lyric') >= 0) && this.noteNumber !== null)
            ret.push("n" + this.noteNumber);
        if (ret.length > 0) {
            const joined: string = ret.join(' ');
            const split: string[] = joined.split(' ');
            const prefixed = [];
            for (let i: number = 0; i < split.length; i++) {
                if (split[i].indexOf('abcjs-') !== 0 && split[i].length > 0)
                    prefixed.push('abcjs-' + split[i]);
                else if (split[i].length > 0)
                    prefixed.push(split[i]);
            }
            return prefixed.join(' ');
        }
        return "";
    }
}
export default Classes;
