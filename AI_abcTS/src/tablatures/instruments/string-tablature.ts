export default class StringTablature {
	public numLines: number;
	public lineSpace: number;
	public verticalSize: number;
	public bar: { pitch: number; pitch2: number; height: number };
	public height: number = 0; // Added default to match usage in setRelative

	constructor(numLines: number, lineSpace: number) {
		this.numLines = numLines;
		this.lineSpace = lineSpace;
		this.verticalSize = this.numLines * this.lineSpace;
		const pitch = 3;
		this.bar = {
			pitch: pitch,
			pitch2: lineSpace * numLines,
			height: 5,
		};
	}

	public bypass(line: any): boolean {
		const voices = line.staffGroup.voices;
		if (voices.length > 0) {
			if (voices[0].isPercussion) return true;
		}
		return false;
	}

	public setRelative(child: any, relative: any, first: boolean): boolean {
		switch (child.type) {
			case 'bar':
				relative.pitch = this.bar.pitch;
				relative.pitch2 = this.bar.pitch2;
				relative.height = this.height;
				break;
			case 'symbol':
				const top = this.bar.pitch2 / 2;
				if (child.name === 'dots.dot') {
					if (first) {
						relative.pitch = top;
						return false;
					} else {
						relative.pitch = top + this.lineSpace;
						return true;
					}
				}
				break;
		}
		return first;
	}
}
