import { noteToMidi, midiToNote } from '../../synth/note-to-midi';

export default class TabNote {
	public pitch: number;
	public pitchAltered: number = 0;
	public name: string;
	public acc: number;
	public isSharp: boolean = false;
	public isKeySharp: boolean = false;
	public isDouble: boolean = false;
	public isAltered: boolean = false;
	public isFlat: boolean = false;
	public isKeyFlat: boolean = false;
	public natural: boolean | null = null;
	public quarter: string | null = null;
	public isLower: boolean;
	public hasComma: number;
	public isQuoted: number;
	public courtesy: boolean;

	constructor(note: string, clefTranspose?: number) {
		let pitch = noteToMidi(note);
		if (clefTranspose) pitch += clefTranspose;
		
		let newNote = midiToNote(pitch);
		let isFlat = false;
		let isSharp = false;
		let isAltered = false;
		let natural: boolean | null = null;
		let quarter: string | null = null;
		let isDouble = false;
		let acc = 0;

		if (note.startsWith('_')) {
			isFlat = true;
			acc = -1;
			if (note[1] === '/') {
				isFlat = false;
				quarter = "v";
				acc = 0;
			} else if (note[1] === '_') {
				isDouble = true;
				acc -= 1;
			}
		} else if (note.startsWith('^')) {
			isSharp = true;
			acc = +1;
			if (note[1] === '/') {
				isSharp = false;
				quarter = "^";
				acc = 0;
			} else if (note[1] === '^') {
				isDouble = true;
				acc += 1;
			}
		} else if (note.startsWith('=')) {
			natural = true;
			acc = 0;
		}

		isAltered = isFlat || isSharp || (quarter != null);
		if (isAltered || natural) {
			if ((quarter != null) || (isDouble)) {
				newNote = note.slice(2);
			} else {
				newNote = note.slice(1);
			}
		}

		const hasComma = (newNote.match(/,/g) || []).length;
		const hasQuote = (newNote.match(/'/g) || []).length;

		this.pitch = pitch;
		this.name = newNote;
		this.acc = acc;
		this.isSharp = isSharp;
		this.isDouble = isDouble;
		this.isAltered = isAltered;
		this.isFlat = isFlat;
		this.natural = natural;
		this.quarter = quarter;
		this.isLower = (this.name === this.name.toLowerCase());
		this.name = this.name[0].toUpperCase();
		this.hasComma = hasComma;
		this.isQuoted = hasQuote;
		
		const currentMidiNote = midiToNote(pitch);
		this.courtesy = note === currentMidiNote; // Simplified approximation of original logic
	}

	public clone(): TabNote {
		const newTabNote = new TabNote(this.emit());
		newTabNote.pitch = this.pitch;
		newTabNote.hasComma = this.hasComma;
		newTabNote.isLower = this.isLower;
		newTabNote.isQuoted = this.isQuoted;
		newTabNote.isSharp = this.isSharp;
		newTabNote.isKeySharp = this.isKeySharp;
		newTabNote.isFlat = this.isFlat;
		newTabNote.isKeyFlat = this.isKeyFlat;
		return newTabNote;
	}

	public sameNoteAs(note: TabNote): boolean {
		return note.pitch === this.pitch;
	}

	public isLowerThan(note: TabNote): boolean {
		return note.pitch > this.pitch;
	}

	public checkKeyAccidentals(accidentals: any[], measureAccidentals: Record<string, string>): void {
		if (this.isAltered || this.natural) return;
		
		const upperName = this.name.toUpperCase();
		if (measureAccidentals[upperName]) {
			switch (measureAccidentals[upperName]) {
				case "__": this.acc = -2; this.pitchAltered = -2; break;
				case "_": this.acc = -1; this.pitchAltered = -1; break;
				case "=": this.acc = 0; this.pitchAltered = 0; break;
				case "^": this.acc = 1; this.pitchAltered = 1; break;
				case "^^": this.acc = 2; this.pitchAltered = 2; break;
			}
		} else if (accidentals) {
			for (let i = 0; i < accidentals.length; i++) {
				const curAcc = accidentals[i];
				if (upperName === curAcc.note.toUpperCase()) {
					if (curAcc.acc === 'flat') {
						this.acc = -1;
						this.isKeyFlat = true;
						this.pitchAltered = -1;
					} else if (curAcc.acc === 'sharp') {
						this.acc = 1;
						this.isKeySharp = true;
						this.pitchAltered = 1;
					}
				}
			}
		}
	}

	public getAccidentalEquiv(): TabNote {
		let cloned = this.clone();
		if (cloned.isSharp || cloned.isKeySharp) {
			cloned = cloned.nextNote();
			cloned.isFlat = true;
			cloned.isSharp = false;
			cloned.isKeySharp = false;
		} else if (cloned.isFlat || cloned.isKeyFlat) {
			cloned = cloned.prevNote();
			cloned.isSharp = true;
			cloned.isFlat = false;
			cloned.isKeyFlat = false;
		}
		return cloned;
	}

	public nextNote(): TabNote {
		const note = midiToNote(this.pitch + 1 + this.pitchAltered);
		return new TabNote(note);
	}

	public prevNote(): TabNote {
		const note = midiToNote(this.pitch - 1 + this.pitchAltered);
		return new TabNote(note);
	}

	public emitNoAccidentals(): string {
		let returned = this.name;
		if (this.isLower) returned = returned.toLowerCase();
		for (let i = 0; i < this.isQuoted; i++) returned += "'";
		for (let j = 0; j < this.hasComma; j++) returned += ",";
		return returned;
	}

	public emit(): string {
		let returned = this.name;
		if (this.isSharp || this.isKeySharp) {
			returned = '^' + returned;
			if (this.isDouble) returned = '^' + returned;
		}
		if (this.isFlat || this.isKeyFlat) {
			returned = '_' + returned;
			if (this.isDouble) returned = '_' + returned;
		}
		if (this.quarter) {
			returned = (this.quarter === "^" ? "^/" : "_/") + returned;
		}
		if (this.natural) returned = '=' + returned;
		
		for (let i = 1; i <= this.hasComma; i++) returned += ',';

		if (this.isLower) {
			returned = returned.toLowerCase();
			for (let j = 1; j <= this.isQuoted; j++) returned += "'";
		}
		return returned;
	}
}
