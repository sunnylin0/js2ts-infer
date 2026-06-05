class BraceElem {
	public startVoice: any;
	public type: string;
	public endVoice: any;
	public header?: string;
	public lastContinuedVoice: any;

	constructor(voice: any, type: string) {
		this.startVoice = voice;
		this.type = type;
	}

	public setBottomStaff(voice: any): void {
		this.endVoice = voice;
		// If only the start brace has a name then the name belongs to the brace instead of the staff.
		if (this.startVoice.header && !this.endVoice.header) {
			this.header = this.startVoice.header;
			delete this.startVoice.header;
		}
	}

	public continuing(voice: any): void {
		// If the final staff isn't present, then use the last one we saw.
		this.lastContinuedVoice = voice;
	}

	public getWidth(): number {
		return 10; // TODO-PER: right now the drawing function doesn't vary the width at all. If it does in the future then this will change.
	}

	public isStartVoice(voice: any): boolean {
		if (this.startVoice && this.startVoice.staff && this.startVoice.staff.voices.length > 0 && this.startVoice.staff.voices[0] === voice)
			return true;
		return false;
	}
}

export default BraceElem;
