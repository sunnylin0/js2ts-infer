interface ClassesOptions {
	shouldAddClasses: boolean;
}

class Classes {
	public shouldAddClasses: boolean;
	public lineNumber: number | null = null;
	public voiceNumber: number | null = null;
	public measureNumber: number | null = null;
	public measureTotalPerLine: number[] = [];
	public noteNumber: number | null = null;

	constructor(options: ClassesOptions) {
		this.shouldAddClasses = options.shouldAddClasses;
		this.reset();
	}

	public reset(): void {
		this.lineNumber = null;
		this.voiceNumber = null;
		this.measureNumber = null;
		this.measureTotalPerLine = [];
		this.noteNumber = null;
	}

	public incrLine(): void {
		if (this.lineNumber === null)
			this.lineNumber = 0;
		else
			this.lineNumber++;
		this.voiceNumber = null;
		this.measureNumber = null;
		this.noteNumber = null;
	}

	public incrVoice(): void {
		if (this.voiceNumber === null)
			this.voiceNumber = 0;
		else
			this.voiceNumber++;
		this.measureNumber = null;
		this.noteNumber = null;
	}

	public isInMeasure(): boolean {
		return this.measureNumber !== null;
	}

	public newMeasure(): void {
		if (this.measureNumber !== null && this.lineNumber !== null)
			this.measureTotalPerLine[this.lineNumber] = this.measureNumber;
		this.measureNumber = null;
		this.noteNumber = null;
	}

	public startMeasure(): void {
		this.measureNumber = 0;
		this.noteNumber = 0;
	}

	public incrMeasure(): void {
		if (this.measureNumber !== null)
			this.measureNumber++;
		this.noteNumber = 0;
	}

	public incrNote(): void {
		if (this.noteNumber !== null)
			this.noteNumber++;
	}

	public measureTotal(): number {
		let total = 0;
		if (this.lineNumber !== null) {
			for (let i = 0; i < this.lineNumber; i++)
				total += this.measureTotalPerLine[i] ? this.measureTotalPerLine[i] : 0;
		}
		if (this.measureNumber !== null)
			total += this.measureNumber;
		return total;
	}

	public getCurrent(c?: string): any {
		return {
			line: this.lineNumber,
			measure: this.measureNumber,
			measureTotal: this.measureTotal(),
			voice: this.voiceNumber,
			note: this.noteNumber
		};
	}

	public generate(c: string): string {
		if (!this.shouldAddClasses)
			return "";
		let ret: string[] = [];
		if (c && c.length > 0) ret.push(c);
		if (c === "abcjs-tab-number")
			return ret.join(' ');
		if (c === "text instrument-name")
			return "abcjs-text abcjs-instrument-name";

		if (this.lineNumber !== null) ret.push("l" + this.lineNumber);
		if (this.measureNumber !== null) {
			ret.push("m" + this.measureNumber);
			ret.push("mm" + this.measureTotal());
		}
		if (this.voiceNumber !== null) ret.push("v" + this.voiceNumber);
		if (c && (c.indexOf('note') >= 0 || c.indexOf('rest') >= 0 || c.indexOf('lyric') >= 0) && this.noteNumber !== null) ret.push("n" + this.noteNumber);

		if (ret.length > 0) {
			const joined = ret.join(' ');
			const split = joined.split(' ');
			const prefixed: string[] = [];
			for (let i = 0; i < split.length; i++) {
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
