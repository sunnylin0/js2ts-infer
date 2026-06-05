import { noteToMidi } from '../../synth/note-to-midi';
import TabNote from './tab-note';
import tabNotes from './tab-notes';

function buildCapo(self: any): string[] | null {
	let capoTuning: string[] | null = null;
	const tuning = self.tuning;
	if (self.capo > 0) {
		capoTuning = [];
		for (let iii = 0; iii < tuning.length; iii++) {
			let curNote = new TabNote(tuning[iii]);
			for (let jjj = 0; jjj < self.capo; jjj++) {
				curNote = curNote.nextNote();
			}
			capoTuning[iii] = curNote.emit();
		}
	}
	return capoTuning;
}

function buildPatterns(self: any): any {
	const strings: any[] = [];
	let tuning = self.tuning;
	if (self.capo > 0) {
		tuning = self.capoTuning;
	}
	let pos = tuning.length - 1;
	for (let iii = 0; iii < tuning.length; iii++) {
		let nextNote = self.highestNote; 
		if (iii !== tuning.length - 1) {
			nextNote = tuning[iii + 1];
		}
		const stringNotes = tabNotes(tuning[iii], nextNote);
		if ((stringNotes as any).error) {
			return stringNotes;
		}
		strings[pos--] = stringNotes;
	}
	return strings;
}

function buildSecond(first: any): any[] {
	const seconds: any[] = [];
	seconds[0] = [];
	const strings = first.strings;
	for (let iii = 1; iii < strings.length; iii++) {
		seconds[iii] = strings[iii - 1];
	}
	return seconds;
}

function sameString(self: any, chord: any[]): void {
	for (let jjjj = 0; jjjj < chord.length - 1; jjjj++) {
		let curPos = chord[jjjj];
		let nextPos = chord[jjjj + 1];
		if (curPos.str === nextPos.str) {
			if (curPos.str === self.strings.length - 1) {
				curPos.num = "?";
				nextPos.num = "?";
				return;
			}
			if (nextPos.num < curPos.num) {
				nextPos.str++;
				nextPos = noteToNumber(self, nextPos.note, nextPos.str, self.secondPos, self.strings[nextPos.str].length) as any;
			} else {
				curPos.str++;
				curPos = noteToNumber(self, curPos.note, curPos.str, self.secondPos, self.strings[curPos.str].length) as any;
			}
			chord[jjjj] = curPos;
			chord[jjjj + 1] = nextPos;
		}
	}
}

function noteToNumber(self: any, note: TabNote, stringNumber: number, secondPosition: any[] | null, firstSize: number): any {
	let strings = self.strings;
	note.checkKeyAccidentals(self.accidentals, self.measureAccidentals);
	if (secondPosition) {
		strings = secondPosition;
	}
	const noteName = note.emitNoAccidentals();
	if (!strings[stringNumber]) return null;
	
	let num = strings[stringNumber].indexOf(noteName);
	let acc = note.acc;
	if (num !== -1) {
		if (secondPosition) {
			num += firstSize;
		}
		if ((note.isFlat || note.acc === -1) && (num === 0)) {
			const noteEquiv = note.getAccidentalEquiv();
			stringNumber++;
			if (strings[stringNumber]) {
				num = strings[stringNumber].indexOf(noteEquiv.emit());
				acc = 0;
			}
		}
		return { num: (num + acc), str: stringNumber, note: note };
	}
	return null;
}

function toNumber(self: any, note: TabNote): any {
	if (note.isAltered || note.natural) {
		let accValue = "=";
		if (note.isFlat) accValue = note.isDouble ? "__" : "_";
		else if (note.isSharp) accValue = note.isDouble ? "^^" : "^";
		else if (note.natural) accValue = "=";
		self.measureAccidentals[note.name.toUpperCase()] = accValue;
	}
	for (let i = self.stringPitches.length - 1; i >= 0; i--) {
		if (note.pitch + note.pitchAltered >= self.stringPitches[i]) {
			let num = note.pitch + note.pitchAltered - self.stringPitches[i];
			if (note.quarter === '^') num -= 0.5;
			else if (note.quarter === "v") num += 0.5;
			return {
				num: Math.round(num),
				str: self.stringPitches.length - 1 - i,
				note: note
			};
		}
	}
	return { num: "?", str: self.stringPitches.length - 1, note: note };
}

function handleChordNotes(self: any, notes: any[]): any[] {
	const retNotes: any[] = [];
	for (let i = 0; i < notes.length; i++) {
		if (notes[i].endTie) continue;
		const note = new TabNote(notes[i].name, self.clefTranspose);
		note.checkKeyAccidentals(self.accidentals, self.measureAccidentals);
		const curPos = toNumber(self, note);
		retNotes.push(curPos);
	}
	sameString(self, retNotes);
	return retNotes;
}

function invalidNumber(retNotes: any[], note: TabNote): void {
	const number = { num: "?", str: 0, note: note };
	retNotes.push(number);
	(retNotes as any).error = note.emit() + ': unexpected note for instrument';
}

export default class StringPatterns {
	public linePitch: number;
	public highestNote: string;
	public measureAccidentals: Record<string, string> = {};
	public capo: number = 0;
	public transpose: number = 0;
	public tuning: string[];
	public stringPitches: number[] = [];
	public capoTuning: string[] | null = null;
	public strings: any;
	public secondPos: any[] | null = null;
	public clefTranspose: number = 0;
	public accidentals: any[] | null = null;

	constructor(plugin: any) {
		const tuning = plugin.tuning;
		const capo = plugin.capo;
		const highestNote = plugin.params.highestNote;
		this.linePitch = plugin.linePitch;
		this.highestNote = highestNote || "a'";
		
		if (capo) {
			this.capo = parseInt(capo, 10);
		}
		this.transpose = plugin.transpose || 0;
		this.tuning = tuning;
		
		for (let i = 0; i < this.tuning.length; i++) {
			const pitch = noteToMidi(this.tuning[i]) + this.capo;
			this.stringPitches.push(pitch);
		}
		
		if (this.capo > 0) {
			this.capoTuning = buildCapo(this);
		}
		this.strings = buildPatterns(this);
		if (this.strings.error) {
			plugin.setError(this.strings.error);
			plugin.inError = true;
			return;
		}
		this.secondPos = buildSecond(this);
	}

	public stringToPitch(stringNumber: number): number {
		const startingPitch = 5.3;
		const bottom = this.strings.length - 1;
		return startingPitch + ((bottom - stringNumber) * this.linePitch);
	}

	public notesToNumber(notes: any[] | null, graces: any[] | null): any {
		let error: string | null = null;
		let retNotes: any[] | null = null;
		
		if (notes) {
			retNotes = [];
			if (notes.length > 1) {
				retNotes = handleChordNotes(this, notes);
				if ((retNotes as any).error) error = (retNotes as any).error;
			} else {
				if (!notes[0].endTie) {
					const note = new TabNote(notes[0].name, this.clefTranspose);
					note.checkKeyAccidentals(this.accidentals, this.measureAccidentals);
					const number = toNumber(this, note);
					if (number) {
						retNotes.push(number);
					} else {
						invalidNumber(retNotes, note);
						error = (retNotes as any).error;
					}
				}
			}
		}
		
		if (error) return { notes: retNotes, graces: null, error: error };
		
		let retGraces: any[] | null = null;
		if (graces) {
			retGraces = [];
			for (let i = 0; i < graces.length; i++) {
				const note = new TabNote(graces[i].name, this.clefTranspose);
				note.checkKeyAccidentals(this.accidentals, this.measureAccidentals);
				const number = toNumber(this, note);
				if (number) {
					retGraces.push(number);
				} else {
					invalidNumber(retGraces, note);
					error = (retGraces as any).error;
				}
			}
		}

		return { notes: retNotes, graces: retGraces, error: error };
	}

	public toString(): string {
		const arr = [];
		for (let i = 0; i < this.tuning.length; i++) {
			let str = this.tuning[i].replace(/,/g, '').replace(/'/g, '').toUpperCase();
			if (str[0] === '_') str = str[1] + 'b ';
			else if (str[0] === '^') str = str[1] + "# ";
			arr.push(str);
		}
		return arr.join('');
	}

	public tabInfos(plugin: any): string {
		let name = plugin.params.label;
		if (name) {
			const tunePos = name.indexOf('%T');
			if (tunePos !== -1) {
				let tuning = this.toString();
				if (plugin.capo > 0) {
					tuning += ` capo:${plugin.capo}`;
				}
				name = name.replace('%T', tuning);
			}
			return name;
		}
		return '';
	}

	public suppress(plugin: any): boolean {
		return !!plugin.params.suppress;
	}
}
