import keyAccidentals from "../const/key-accidentals";
import { relativeMajor, transposeKey, relativeMode, isLegalMode } from "../const/relative-major";
// @ts-ignore
import transposeChordName from "../parse/transpose-chord";

const letters = "CDEFGAB";
// const octaves = [",,,,", ",,,", ",,", ",", "", "'", "''", "'''", "''''"];

export default function strTranspose(abc: string, abcTune: any, steps: number | string): string {
	if (abcTune === "TEST") {
		return { keyAccidentals, relativeMajor, transposeKey, relativeMode, transposeChordName } as any;
	}
	const stepsNum = typeof steps === 'string' ? parseInt(steps, 10) : steps;
	let changes: any[] = [];
	
	const tunes = Array.isArray(abcTune) ? abcTune : [abcTune];
	for (let i = 0; i < tunes.length; i++) {
		changes = changes.concat(transposeOneTune(abc, tunes[i], stepsNum));
	}

	// Reverse sort so that we are replacing strings from the end to the beginning so that the indexes aren't invalidated as we go.
	changes.sort((a, b) => b.start - a.start);

	const output = abc.split('');
	for (let i = 0; i < changes.length; i++) {
		const ch = changes[i];
		output.splice(ch.start, ch.end - ch.start, ch.note);
	}
	return output.join('');
}

function transposeOneTune(abc: string, abcTune: any, steps: number): any[] {
	let changes: any[] = [];

	const key = abcTune.getKeySignature();
	if (key.root === 'Hp' || key.root === "HP")
		return changes;

	changes = changes.concat(changeAllKeySigs(abc, steps));

	for (let i = 0; i < abcTune.lines.length; i++) {
		const staves = abcTune.lines[i].staff;
		if (staves) {
			for (let j = 0; j < staves.length; j++) {
				const staff = staves[j];
				if (staff.clef.type !== "perc")
					changes = changes.concat(transposeVoices(abc, staff.voices, staff.key, steps));
			}
		}
	}
	return changes;
}

function changeAllKeySigs(abc: string, steps: number): any[] {
	const changes: any[] = [];
	const arr = abc.split("K:");
	let count = arr[0].length;
	for (let i = 1; i < arr.length; i++) {
		const segment = arr[i];
		const match = segment.match(/^( *)([A-G])([#b]?)( ?)(\w*)/);
		if (match) {
			const start = count + 2 + match[1].length;
			const mode = isLegalMode(match[5]) ? match[5] : '';
			const key = match[2] + match[3] + match[4] + mode;
			const destinationKey = getNewKey({ root: match[2], acc: match[3], mode: mode }, steps);
			const dest = destinationKey.root + destinationKey.acc + match[4] + destinationKey.mode;
			changes.push({ start: start, end: start + key.length, note: dest });
		}
		count += segment.length + 2;
	}
	return changes;
}

function transposeVoices(abc: string, voices: any[], key: any, steps: number): any[] {
	let changes: any[] = [];
	const destinationKey = getNewKey(key, steps);
	for (let i = 0; i < voices.length; i++) {
		changes = changes.concat(transposeVoice(abc, voices[i], key.root, createKeyAccidentals(key), destinationKey, steps));
	}
	return changes;
}

function createKeyAccidentals(key: any): Record<string, string> {
	const ret: Record<string, string> = {};
	if (key.accidentals) {
		for (let i = 0; i < key.accidentals.length; i++) {
			const acc = key.accidentals[i];
			if (acc.acc === 'flat')
				ret[acc.note.toUpperCase()] = '_';
			else if (acc.acc === 'sharp')
				ret[acc.note.toUpperCase()] = '^';
		}
	}
	return ret;
}

function setLetterDistance(destinationKey: any, keyRoot: string, steps: number): number {
	let letterDistance = letters.indexOf(destinationKey.root) - letters.indexOf(keyRoot);
	if (keyRoot === "none")
		letterDistance = letters.indexOf(destinationKey.root);
	
	if (letterDistance === 0) {
		if (steps > 2)
			letterDistance += 7;
		else if (steps === -12)
			letterDistance -= 7;
	} else if (steps > 0 && letterDistance < 0)
		letterDistance += 7;
	else if (steps < 0 && letterDistance > 0)
		letterDistance -= 7;

	if (steps > 12)
		letterDistance += 7;
	else if (steps < -12)
		letterDistance -= 7;

	return letterDistance;
}

function transposeVoice(abc: string, voice: any[], keyRoot: string, keyAccidentalsMap: Record<string, string>, destinationKey: any, steps: number): any[] {
	let changes: any[] = [];
	let letterDistance = setLetterDistance(destinationKey, keyRoot, steps);

	let measureAccidentals: Record<string, string> = {};
	let transposedMeasureAccidentals: Record<string, string> = {};
	
	for (let i = 0; i < voice.length; i++) {
		const el = voice[i];
		if (el.chord) {
			for (let c = 0; c < el.chord.length; c++) {
				const ch = el.chord[c];
				if (ch.position === 'default') {
					const prefersFlats = destinationKey.accidentals.length && destinationKey.accidentals[0].acc === 'flat';
					let newChord = transposeChordName(ch.name, steps, prefersFlats, true);
					newChord = newChord.replace(/♭/g, "b").replace(/♯/g, "#");
					if (newChord !== ch.name)
						changes.push(replaceChord(abc, el.startChar, el.endChar, newChord));
				}
			}
		}
		if (el.el_type === 'note' && el.pitches) {
			const pitchArray = findNotes(abc, el.startChar, el.endChar);
			for (let j = 0; j < pitchArray.length; j++) {
				const note = parseNote(pitchArray[j].note, keyRoot, keyAccidentalsMap, measureAccidentals);
				if (note.acc)
					measureAccidentals[note.name.toUpperCase()] = note.acc;
				const newPitch = transposePitch(note, destinationKey, letterDistance, transposedMeasureAccidentals);
				if (newPitch.acc)
					transposedMeasureAccidentals[newPitch.upper] = newPitch.acc;
				changes.push({ note: newPitch.acc + newPitch.name, start: pitchArray[j].index, end: pitchArray[j].index + pitchArray[j].note.length });
			}
			if (el.gracenotes) {
				for (let g = 0; g < el.gracenotes.length; g++) {
					const grace = parseNote(el.gracenotes[g].name, keyRoot, keyAccidentalsMap, measureAccidentals);
					if (grace.acc)
						measureAccidentals[grace.name.toUpperCase()] = grace.acc;
					const newGrace = transposePitch(grace, destinationKey, letterDistance, transposedMeasureAccidentals);
					if (newGrace.acc)
						transposedMeasureAccidentals[newGrace.upper] = newGrace.acc;
					changes.push(replaceGrace(abc, el.startChar, el.endChar, newGrace.acc + newGrace.name, g));
				}
			}
		} else if (el.el_type === "bar") {
			measureAccidentals = {};
			transposedMeasureAccidentals = {};
		} else if (el.el_type === "keySignature") {
			keyRoot = el.root;
			const keyAccs = createKeyAccidentals(el);
			destinationKey = getNewKey(el, steps);
			letterDistance = setLetterDistance(destinationKey, keyRoot, steps);
			keyAccidentalsMap = keyAccs;
		}
	}
	return changes;
}

function getNewKey(key: any, steps: number): any {
	if (key.root === "none") {
		return { root: transposeKey("C", steps), mode: "", acc: "", accidentals: [] };
	}
	const major = relativeMajor(key.root + key.acc + key.mode);
	const newMajor = transposeKey(major, steps);
	const newMode = relativeMode(newMajor, key.mode);
	const acc = keyAccidentals(newMajor);
	return { root: newMode[0], mode: key.mode, acc: newMode.length > 1 ? newMode[1] : '', accidentals: acc };
}

function transposePitch(note: any, key: any, letterDistance: number, measureAccidentals: Record<string, string>): any {
	const pitch = note.pitch;
	const origDistFromC = letters.indexOf(note.name);
	const root = letters.indexOf(key.root);
	const index = (root + pitch) % 7;
	let newDistFromC = origDistFromC + letterDistance;
	let oct = note.oct;
	while (newDistFromC > 6) {
		oct++;
		newDistFromC -= 7;
	}
	while (newDistFromC < 0) {
		oct--;
		newDistFromC += 7;
	}

	let name = letters[index];
	let acc = '';
	let adj = note.adj;
	let keyAcc = '=';
	for (let i = 0; i < key.accidentals.length; i++) {
		if (key.accidentals[i].note.toLowerCase() === name.toLowerCase()) {
			adj = adj + (key.accidentals[i].acc === 'flat' ? -1 : 1);
			keyAcc = (key.accidentals[i].acc === 'flat' ? '_' : '^');
			break;
		}
	}
	
	let newNote: any;
	switch (adj) {
		case -2: acc = "__"; break;
		case -1: acc = "_"; break;
		case 0: acc = "="; break;
		case 1: acc = "^"; break;
		case 2: acc = "^^"; break;
		case -3:
			newNote = {
				pitch: note.pitch - 1,
				oct: note.oct,
				name: letters[letters.indexOf(note.name) - 1]
			};
			if (!newNote.name) {
				newNote.name = "B";
				newNote.oct--;
			}
			if (newNote.name === "B" || newNote.name === "E")
				newNote.adj = note.adj + 1;
			else
				newNote.adj = note.adj + 2;
			return transposePitch(newNote, key, letterDistance + 1, measureAccidentals);
		case 3:
			newNote = {
				pitch: note.pitch + 1,
				oct: note.oct,
				name: letters[letters.indexOf(note.name) + 1]
			};
			if (!newNote.name) {
				newNote.name = "C";
				newNote.oct++;
			}
			if (newNote.name === "C" || newNote.name === "F")
				newNote.adj = note.adj - 1;
			else
				newNote.adj = note.adj - 2;
			return transposePitch(newNote, key, letterDistance + 1, measureAccidentals);
	}
	
	if ((measureAccidentals[name] === acc || (!measureAccidentals[name] && acc === keyAcc)) && !note.courtesy)
		acc = "";

	let finalName = name;
	switch (oct) {
		case 0: finalName = finalName + ",,,"; break;
		case 1: finalName = finalName + ",,"; break;
		case 2: finalName = finalName + ","; break;
		case 4: finalName = finalName.toLowerCase(); break;
		case 5: finalName = finalName.toLowerCase() + "'"; break;
		case 6: finalName = finalName.toLowerCase() + "''"; break;
		case 7: finalName = finalName.toLowerCase() + "'''"; break;
		case 8: finalName = finalName.toLowerCase() + "''''"; break;
	}
	if (oct > 4)
		finalName = finalName.toLowerCase();

	return { acc: acc, name: finalName, upper: finalName.toUpperCase() };
}

const regPitch = /([_^=]*)([A-Ga-g])([,']*)/;
const regOptionalNote = /([_^=]*[A-Ga-g][,']*)?(\d*\/*\d*)?([\>\<\-\)]*)?/;

function parseNote(note: string, keyRoot: string, keyAccidentalsMap: Record<string, string>, measureAccidentals: Record<string, string>): any {
	const root = keyRoot === "none" ? 0 : letters.indexOf(keyRoot);
	const match = note.match(regPitch);
	if (!match) return null;
	
	const name = match[2].toUpperCase();
	let pos = letters.indexOf(name) - root;
	if (pos < 0) pos += 7;
	
	const octavesArr = [",,,,", ",,,", ",,", ",", "", "'", "''", "'''", "''''"];
	let oct = octavesArr.indexOf(match[3]);
	if (name === match[2])
		oct--;
	
	const currentAcc = measureAccidentals[name] || keyAccidentalsMap[name] || "=";
	return { 
		acc: match[1], 
		name: name, 
		pitch: pos, 
		oct: oct, 
		adj: calcAdjustment(match[1], keyAccidentalsMap[name], measureAccidentals[name]), 
		courtesy: match[1] === currentAcc 
	};
}

function findNotes(abc: string, start: number, end: number): any[] {
	const note = abc.substring(start, end);
	let array: any;
	const ignoreBlocks: any[] = [];
	const regChord = /("[^"]+")+/g;
	while ((array = regChord.exec(note)) !== null) {
		ignoreBlocks.push({ start: regChord.lastIndex - array[0].length, end: regChord.lastIndex });
	}
	const regDec = /(![^!]+!)+/g;
	while ((array = regDec.exec(note)) !== null) {
		ignoreBlocks.push({ start: regDec.lastIndex - array[0].length, end: regDec.lastIndex });
	}

	const ret: any[] = [];
	const regPitchGlobal = /([_^=]*)([A-Ga-g])([,']*)/g;
	while ((array = regPitchGlobal.exec(note)) !== null) {
		let found = false;
		for (let i = 0; i < ignoreBlocks.length; i++) {
			if (regPitchGlobal.lastIndex >= ignoreBlocks[i].start && regPitchGlobal.lastIndex <= ignoreBlocks[i].end)
				found = true;
		}
		if (!found)
			ret.push({ note: array[0], index: start + regPitchGlobal.lastIndex - array[0].length });
	}
	return ret;
}

function replaceGrace(abc: string, start: number, end: number, newGrace: string, index: number): any {
	const noteStr = abc.substring(start, end);
	const regOpenBrace = /\{/;
	const regCloseBrace = /\}/;
	const regPreBrace = /([^\{]*)/;
	const regPreNote = /(\/*)/;
	const regex = new RegExp(regPreBrace.source + regOpenBrace.source + regPreNote.source + regOptionalNote.source +
		regPreNote.source + regOptionalNote.source + regPreNote.source + regOptionalNote.source + regPreNote.source + regOptionalNote.source +
		regPreNote.source + regOptionalNote.source + regPreNote.source + regOptionalNote.source + regPreNote.source + regOptionalNote.source +
		regPreNote.source + regOptionalNote.source + regCloseBrace.source);
	
	const match = noteStr.match(regex);
	if (match) {
		let count = 1 + match[1].length;
		for (let i = 0; i < index; i++) {
			if (match[i * 3 + 2]) count += match[i * 3 + 2].length;
			if (match[i * 3 + 3]) count += match[i * 3 + 3].length;
			if (match[i * 3 + 4]) count += match[i * 3 + 4].length;
			if (match[i * 3 + 5]) count += match[i * 3 + 5].length;
		}
		if (match[index * 3 + 2]) count += match[index * 3 + 2].length;
		const finalStart = start + count;
		
		let endLen = match[index * 3 + 3] ? match[index * 3 + 3].length : 0;
		endLen += match[index * 3 + 4] ? match[index * 3 + 4].length : 0;
		endLen += match[index * 3 + 5] ? match[index * 3 + 5].length : 0;

		return { start: finalStart, end: finalStart + endLen, note: newGrace };
	}
	return { start: start, end: end, note: newGrace };
}

function replaceChord(abc: string, start: number, end: number, newChord: string): any {
	const match = abc.substring(start, end).match(/([^"]+)?(".+")+/);
	if (match) {
		let finalStart = start;
		if (match[1]) finalStart += match[1].length;
		const finalEnd = finalStart + match[2].length;
		return { start: finalStart + 1, end: finalEnd - 1, note: newChord };
	}
	return { start, end, note: newChord };
}

function calcAdjustment(thisAccidental: string | undefined, keyAccidental: string | undefined, measureAccidental: string | undefined): number {
	let acc = thisAccidental;
	if (!acc && measureAccidental) {
		acc = measureAccidental;
	}
	if (!acc) return 0;

	switch (keyAccidental) {
		case undefined:
			switch (acc) {
				case '__': return -2;
				case '_': return -1;
				case '=': return 0;
				case '^': return 1;
				case '^^': return 2;
				default: return 0;
			}
		case '_':
			switch (acc) {
				case '__': return -1;
				case '_': return 0;
				case '=': return 1;
				case '^': return 2;
				case '^^': return 3;
				default: return 0;
			}
		case '^':
			switch (acc) {
				case '__': return -3;
				case '_': return -2;
				case '=': return -1;
				case '^': return 0;
				case '^^': return 1;
				default: return 0;
			}
	}
	return 0;
}
