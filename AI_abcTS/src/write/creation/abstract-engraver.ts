// abc_abstract_engraver.ts: Creates a data structure suitable for printing a line of abc

import AbsoluteElement from './elements/absolute-element';
import BeamElem from './elements/beam-element';
import BraceElem from './elements/brace-element';
import createClef from './create-clef';
import createKeySignature from './create-key-signature';
import createNoteHead from './create-note-head';
import createTimeSignature from './create-time-signature';
import Decoration from './decoration';
import EndingElem from './elements/ending-element';
import glyphs from './glyphs';
import RelativeElement from './elements/relative-element';
import spacing from '../helpers/spacing';
import StaffGroupElement from './elements/staff-group-element';
import TempoElement from './elements/tempo-element';
import TieElem from './elements/tie-element';
import TripletElem from './elements/triplet-element';
import VoiceElement from './elements/voice-element';
import addChord from './add-chord';
import pitchesToPerc from '../../synth/pitches-to-perc';
import parseCommon from '../../parse/abc_common';

const getDuration = (elem: any): number => {
	let d = 0;
	if (elem.duration) {
		d = elem.duration;
	}
	return d;
};

let hint = false;

const chartable: Record<string, Record<string, string>> = {
	rest: { 0: "rests.whole", 1: "rests.half", 2: "rests.quarter", 3: "rests.8th", 4: "rests.16th", 5: "rests.32nd", 6: "rests.64th", 7: "rests.128th", "multi": "rests.multimeasure" },
	note: { "-1": "noteheads.dbl", 0: "noteheads.whole", 1: "noteheads.half", 2: "noteheads.quarter", 3: "noteheads.quarter", 4: "noteheads.quarter", 5: "noteheads.quarter", 6: "noteheads.quarter", 7: "noteheads.quarter", 'nostem': "noteheads.quarter" },
	rhythm: { "-1": "noteheads.slash.whole", 0: "noteheads.slash.whole", 1: "noteheads.slash.whole", 2: "noteheads.slash.quarter", 3: "noteheads.slash.quarter", 4: "noteheads.slash.quarter", 5: "noteheads.slash.quarter", 6: "noteheads.slash.quarter", 7: "noteheads.slash.quarter", nostem: "noteheads.slash.nostem" },
	x: { "-1": "noteheads.indeterminate", 0: "noteheads.indeterminate", 1: "noteheads.indeterminate", 2: "noteheads.indeterminate", 3: "noteheads.indeterminate", 4: "noteheads.indeterminate", 5: "noteheads.indeterminate", 6: "noteheads.indeterminate", 7: "noteheads.indeterminate", nostem: "noteheads.indeterminate" },
	harmonic: { "-1": "noteheads.harmonic.quarter", 0: "noteheads.harmonic.quarter", 1: "noteheads.harmonic.quarter", 2: "noteheads.harmonic.quarter", 3: "noteheads.harmonic.quarter", 4: "noteheads.harmonic.quarter", 5: "noteheads.harmonic.quarter", 6: "noteheads.harmonic.quarter", 7: "noteheads.harmonic.quarter", nostem: "noteheads.harmonic.quarter" },
	triangle: { "-1": "noteheads.triangle.quarter", 0: "noteheads.triangle.quarter", 1: "noteheads.triangle.quarter", 2: "noteheads.triangle.quarter", 3: "noteheads.triangle.quarter", 4: "noteheads.triangle.quarter", 5: "noteheads.triangle.quarter", 6: "noteheads.triangle.quarter", 7: "noteheads.triangle.quarter", nostem: "noteheads.triangle.quarter" },
	uflags: { 3: "flags.u8th", 4: "flags.u16th", 5: "flags.u32nd", 6: "flags.u64th" },
	dflags: { 3: "flags.d8th", 4: "flags.d16th", 5: "flags.d32nd", 6: "flags.d64th" }
};

class AbstractEngraver {
	public decoration: any; // Decoration
	public getTextSize: any;
	public tuneNumber: number;
	public isBagpipes: boolean;
	public flatBeams: boolean;
	public graceSlurs: boolean;
	public percmap: any;
	public initialClef: any;
	public jazzchords: boolean;
	public accentAbove: boolean;
	public germanAlphabet: boolean;

	public slurs: Record<string, any> = {} as any;
	public ties: any[] = [];
	public voiceScale: number = 1;
	public voiceColor?: string;
	public slursbyvoice: Record<string, any> = {} as any;
	public tiesbyvoice: Record<string, any[]> = {} as any;
	public endingsbyvoice: Record<string, any> = {} as any;
	public scaleByVoice: Record<string, number> = {} as any;
	public colorByVoice: Record<string, string> = {} as any;
	public tripletmultiplier: number = 1;

	public abcline: any;
	public accidentalSlot: any;
	public accidentalshiftx: any;
	public dotshiftx: any;
	public hasVocals: boolean = false;
	public minY?: number;
	public maxY?: number;
	public partstartelem: any;
	public startlimitelem: any;
	public stemdir?: string;
	public stemHeight: number = 0;
	public measureLength: number = 1;

	// For state saving
	private tiesSave: any[] = [];
	private slursSave: Record<string, any> = {} as any;
	private slursbyvoiceSave: Record<string, any> = {} as any;
	private tiesbyvoiceSave: Record<string, any[]> = {} as any;
	private style?: string;
	private triplet: any = null;
	private tempoSet: boolean = false;

	constructor(getTextSize: any, tuneNumber: number, options: any) {
		this.decoration = new Decoration();
		this.getTextSize = getTextSize;
		this.tuneNumber = tuneNumber;
		this.isBagpipes = !!options.bagpipes;
		this.flatBeams = !!options.flatbeams;
		this.graceSlurs = !!options.graceSlurs;
		this.percmap = options.percmap;
		this.initialClef = options.initialClef;
		this.jazzchords = !!options.jazzchords;
		this.accentAbove = !!options.accentAbove;
		this.germanAlphabet = !!options.germanAlphabet;
		this.reset();
	}

	public reset(): void {
		this.slurs = {} as any;
		this.ties = [];
		this.voiceScale = 1;
		this.voiceColor = undefined;
		this.slursbyvoice = {} as any;
		this.tiesbyvoice = {} as any;
		this.endingsbyvoice = {} as any;
		this.scaleByVoice = {} as any;
		this.colorByVoice = {} as any;
		this.tripletmultiplier = 1;

		this.abcline = undefined;
		this.accidentalSlot = undefined;
		this.accidentalshiftx = undefined;
		this.dotshiftx = undefined;
		this.hasVocals = false;
		this.minY = undefined;
		this.partstartelem = undefined;
		this.startlimitelem = undefined;
		this.stemdir = undefined;
	}

	public setStemHeight(heightInPixels: number): void {
		this.stemHeight = Math.round(heightInPixels * 10 / spacing.STEP) / 10;
	}

	public getCurrentVoiceId(s: number, v: number): string {
		return "s" + s + "v" + v;
	}

	public pushCrossLineElems(s: number, v: number): void {
		const id = this.getCurrentVoiceId(s, v);
		this.slursbyvoice[id] = this.slurs;
		this.tiesbyvoice[id] = this.ties;
		this.endingsbyvoice[id] = this.partstartelem;
		this.scaleByVoice[id] = this.voiceScale;
		if (this.voiceColor)
			this.colorByVoice[id] = this.voiceColor;
	}

	public popCrossLineElems(s: number, v: number): void {
		const id = this.getCurrentVoiceId(s, v);
		this.slurs = this.slursbyvoice[id] || ({} as any);
		this.ties = this.tiesbyvoice[id] || [];
		this.partstartelem = this.endingsbyvoice[id];
		this.voiceScale = this.scaleByVoice[id];
		if (this.voiceScale === undefined) this.voiceScale = 1;
		this.voiceColor = this.colorByVoice[id];
	}

	public containsLyrics(staves: any[]): void {
		for (let i = 0; i < staves.length; i++) {
			for (let j = 0; j < staves[i].voices.length; j++) {
				for (let k = 0; k < staves[i].voices[j].length; k++) {
					const el = staves[i].voices[j][k];
					if (el.lyric) {
						if (!el.positioning || el.positioning.vocalPosition === 'below')
							this.hasVocals = true;
						return;
					}
				}
			}
		}
	}

	public createABCLine(staffs: any[], tempo: any, l: number): any {
		this.minY = 2; // PER: This will be the lowest that any note reaches. It will be used to set the dynamics row.
		this.containsLyrics(staffs);
		const staffgroup = new StaffGroupElement(this.getTextSize);
		this.tempoSet = false;
		for (let s = 0; s < staffs.length; s++) {
			if (hint)
				this.restoreState();
			hint = false;
			this.createABCStaff(staffgroup, staffs[s], tempo, s, l);
		}
		return staffgroup;
	}

	public createABCStaff(staffgroup: any, abcstaff: any, tempo: any, s: number, l: number): void {
		staffgroup.getTextSize.updateFonts(abcstaff);
		for (let v = 0; v < abcstaff.voices.length; v++) {
			const voice = new VoiceElement(v, abcstaff.voices.length) as any;
			if (v === 0) {
				voice.barfrom = (abcstaff.connectBarLines === "start" || abcstaff.connectBarLines === "continue");
				voice.barto = (abcstaff.connectBarLines === "continue" || abcstaff.connectBarLines === "end");
			} else {
				voice.duplicate = true;
			}
			if (abcstaff.title && abcstaff.title[v]) {
				voice.header = abcstaff.title[v].replace(/\\n/g, "\n");
				voice.headerPosition = 6 + staffgroup.getTextSize.baselineToCenter(voice.header, "voicefont", 'staff-extra voice-name', v, abcstaff.voices.length) / spacing.STEP;
			}
			if (abcstaff.clef && abcstaff.clef.type === "perc")
				voice.isPercussion = true;
			const clef = (!this.initialClef || l === 0) && createClef(abcstaff.clef, this.tuneNumber);
			if (clef) {
				if (v === 0 && abcstaff.barNumber) {
					this.addMeasureNumber(abcstaff.barNumber, clef);
				}
				voice.addChild(clef);
				this.startlimitelem = clef;
			}
			const keySig = createKeySignature(abcstaff.key, this.tuneNumber);
			if (keySig) {
				voice.addChild(keySig);
				this.startlimitelem = keySig;
			}
			if (abcstaff.meter) {
				if (abcstaff.meter.type === 'specified') {
					this.measureLength = abcstaff.meter.value[0].num / abcstaff.meter.value[0].den;
				} else
					this.measureLength = 1;
				const ts = createTimeSignature(abcstaff.meter, this.tuneNumber);
				voice.addChild(ts);
				this.startlimitelem = ts;
			}
			if (voice.duplicate)
				voice.children = [];
			const staffLines = abcstaff.clef.stafflines || abcstaff.clef.stafflines === 0 ? abcstaff.clef.stafflines : 5;
			staffgroup.addVoice(voice, s, staffLines);
			const isSingleLineStaff = staffLines === 1;
			this.createABCVoice(abcstaff.voices[v], tempo, s, v, isSingleLineStaff, voice as any);
			staffgroup.setStaffLimits(voice);
			if (v === 0) {
				if (abcstaff.brace === "start" || (!staffgroup.brace && abcstaff.brace)) {
					if (!staffgroup.brace)
						staffgroup.brace = [];
					staffgroup.brace.push(new BraceElem(voice, "brace"));
				} else if (abcstaff.brace === "end" && staffgroup.brace) {
					staffgroup.brace[staffgroup.brace.length - 1].setBottomStaff(voice);
				} else if (abcstaff.brace === "continue" && staffgroup.brace) {
					staffgroup.brace[staffgroup.brace.length - 1].continuing(voice);
				}
				if (abcstaff.bracket === "start" || (!staffgroup.bracket && abcstaff.bracket)) {
					if (!staffgroup.bracket)
						staffgroup.bracket = [];
					staffgroup.bracket.push(new BraceElem(voice, "bracket"));
				} else if (abcstaff.bracket === "end" && staffgroup.bracket) {
					staffgroup.bracket[staffgroup.bracket.length - 1].setBottomStaff(voice);
				} else if (abcstaff.bracket === "continue" && staffgroup.bracket) {
					staffgroup.bracket[staffgroup.bracket.length - 1].continuing(voice);
				}
			}
		}
	}

	public createABCVoice(abcline: any, tempo: any, s: number, v: number, isSingleLineStaff: boolean, voice: any): void {
		this.popCrossLineElems(s, v);
		this.stemdir = (this.isBagpipes) ? "down" : undefined;
		this.abcline = abcline;
		if (this.partstartelem) {
			this.partstartelem = new EndingElem("", null, null);
			voice.addOther(this.partstartelem);
		}
		const voiceNumber = voice.voicetotal < 2 ? -1 : voice.voicenumber;
		for (const slur in this.slurs) {
			if (Object.prototype.hasOwnProperty.call(this.slurs, slur)) {
				this.slurs[slur] = new TieElem({ force: this.slurs[slur].force, voiceNumber: voiceNumber, stemDir: this.slurs[slur].stemDir, style: this.slurs[slur].dotted });
				if (hint) this.slurs[slur].setHint();
				voice.addOther(this.slurs[slur]);
			}
		}
		for (let i = 0; i < this.ties.length; i++) {
			this.ties[i] = new TieElem({ force: this.ties[i].force, stemDir: this.ties[i].stemDir, voiceNumber: voiceNumber, style: this.ties[i].dotted });
			if (hint) this.ties[i].setHint();
			voice.addOther(this.ties[i]);
		}

		for (let j = 0; j < this.abcline.length; j++) {
			setAveragePitch(this.abcline[j]);
			this.minY = Math.min(this.abcline[j].minpitch, this.minY || 999);
		}

		const isFirstStaff = (s === 0);
		let pos = 0;
		while (pos < this.abcline.length) {
			const ret = getBeamGroup(this.abcline, pos);
			const abselems = this.createABCElement(isFirstStaff, isSingleLineStaff, voice, ret.elem);
			if (abselems) {
				for (let i = 0; i < abselems.length; i++) {
					if (!this.tempoSet && tempo && !tempo.suppress) {
						this.tempoSet = true;
						const tempoElement = new AbsoluteElement(tempo, 0, 0, "tempo", this.tuneNumber, {});
						tempoElement.addFixedX(new TempoElement(tempo, this.tuneNumber, createNoteHead));
						voice.addChild(tempoElement);
					}
					voice.addChild(abselems[i]);
				}
			}
			pos += ret.count;
		}
		this.decoration.endLine(voice);
		this.pushCrossLineElems(s, v);
	}

	public saveState(): void {
		this.tiesSave = parseCommon.cloneArray(this.ties);
		this.slursSave = parseCommon.cloneHashOfHash(this.slurs) as any;
		this.slursbyvoiceSave = parseCommon.cloneHashOfHash(this.slursbyvoice) as any;
		this.tiesbyvoiceSave = parseCommon.cloneHashOfArrayOfHash(this.tiesbyvoice) as any;
	}

	public restoreState(): void {
		this.ties = parseCommon.cloneArray(this.tiesSave);
		this.slurs = parseCommon.cloneHashOfHash(this.slursSave) as any;
		this.slursbyvoice = parseCommon.cloneHashOfHash(this.slursbyvoiceSave) as any;
		this.tiesbyvoice = parseCommon.cloneHashOfArrayOfHash(this.tiesbyvoiceSave) as any;
	}

	public createABCElement(isFirstStaff: boolean, isSingleLineStaff: boolean, voice: any, elem: any): any[] | null {
		const elemset: any[] = [];
		switch (elem.el_type) {
			case undefined:
				elemset.push(...this.createBeam(isSingleLineStaff, voice, elem));
				break;
			case "note":
				elemset[0] = this.createNote(elem, false, isSingleLineStaff, voice);
				if (this.triplet && this.triplet.isClosed()) {
					voice.addOther(this.triplet);
					this.triplet = null;
					this.tripletmultiplier = 1;
				}
				break;
			case "bar":
				elemset[0] = this.createBarLine(voice, elem, isFirstStaff);
				if (voice.duplicate && elemset.length > 0) elemset[0].invisible = true;
				break;
			case "meter":
				elemset[0] = createTimeSignature(elem, this.tuneNumber);
				this.startlimitelem = elemset[0];
				if (voice.duplicate && elemset.length > 0) elemset[0].invisible = true;
				break;
			case "clef":
				elemset[0] = createClef(elem, this.tuneNumber);
				if (!elemset[0]) return null;
				if (voice.duplicate && elemset.length > 0) elemset[0].invisible = true;
				break;
			case "key":
				const absKey = createKeySignature(elem, this.tuneNumber);
				if (absKey) {
					elemset[0] = absKey;
					this.startlimitelem = elemset[0];
				}
				if (voice.duplicate && elemset.length > 0) elemset[0].invisible = true;
				break;
			case "stem":
				this.stemdir = elem.direction === "auto" ? undefined : elem.direction;
				break;
			case "part":
				const abselem = new AbsoluteElement(elem, 0, 0, 'part', this.tuneNumber);
				const dim = this.getTextSize.calc(elem.title, 'partsfont', "part");
				abselem.addFixedX(new RelativeElement(elem.title, 0, 0, undefined, { type: "part", height: dim.height / spacing.STEP }));
				elemset[0] = abselem;
				break;
			case "tempo":
				const abselem3 = new AbsoluteElement(elem, 0, 0, 'tempo', this.tuneNumber);
				if (!elem.suppress) {
					abselem3.addFixedX(new TempoElement(elem, this.tuneNumber, createNoteHead));
				}
				elemset[0] = abselem3;
				break;
			case "style":
				if (elem.head === "normal")
					this.style = undefined;
				else
					this.style = elem.head;
				break;
			case "hint":
				hint = true;
				this.saveState();
				break;
			case "midi":
				break;
			case "scale":
				this.voiceScale = elem.size;
				break;
			case "color":
				this.voiceColor = elem.color;
				voice.color = this.voiceColor;
				break;

			default:
				const abselem2 = new AbsoluteElement(elem, 0, 0, 'unsupported', this.tuneNumber);
				abselem2.addFixed(new RelativeElement("element type " + elem.el_type, 0, 0, undefined, { type: "debug" }));
				elemset[0] = abselem2;
		}

		return elemset;
	}

	public createBeam(isSingleLineStaff: boolean, voice: any, elems: any[]): any[] {
		const abselemset: any[] = [];
		const beamelem = new BeamElem(this.stemHeight * this.voiceScale, this.stemdir, this.flatBeams, elems[0]);
		if (hint) beamelem.setHint();
		for (let i = 0; i < elems.length; i++) {
			beamelem.runningDirection(elems[i]);
		}
		beamelem.setStemDirection();
		const tempStemDir = this.stemdir;
		this.stemdir = beamelem.stemsUp ? 'up' : 'down';
		for (let i = 0; i < elems.length; i++) {
			const elem = elems[i];
			const abselem = this.createNote(elem, true, isSingleLineStaff, voice);
			abselemset.push(abselem);
			beamelem.add(abselem);
			if (this.triplet && this.triplet.isClosed()) {
				voice.addOther(this.triplet);
				this.triplet = null;
				this.tripletmultiplier = 1;
			}
		}
		beamelem.calcDir();
		voice.addBeam(beamelem);
		this.stemdir = tempStemDir;
		return abselemset;
	}

	public createNote(elem: any, nostem: boolean, isSingleLineStaff: boolean, voice: any): any {
		let notehead = null;
		let roomtaken = 0;
		let roomtakenright = 0;
		let symbolWidth = 0;
		let additionalLedgers: number[] = [];
		let dir: string | undefined;

		let duration = getDuration(elem);
		let zeroDuration = false;
		if (duration === 0) { zeroDuration = true; duration = 0.25; nostem = true; }
		const durlog = Math.floor(Math.log(duration) / Math.log(2));
		let dot = 0;

		for (let tot = Math.pow(2, durlog), inc = tot / 2; tot < duration; dot++, tot += inc, inc /= 2);

		if (elem.startTriplet) {
			this.tripletmultiplier = elem.tripletMultiplier;
		}

		const durationForSpacing = (elem.rest && elem.rest.type === 'multimeasure') ? 1 :
			(elem.rest && elem.rest.type === 'invisible-multimeasure' ? this.measureLength * elem.rest.text :
				duration * this.tripletmultiplier);

		const absType = elem.rest ? "rest" : "note";
		const abselem = new AbsoluteElement(elem, durationForSpacing, 1, absType, this.tuneNumber, { durationClassOveride: elem.duration * this.tripletmultiplier });
		if (hint) abselem.setHint();

		if (elem.rest) {
			if (this.measureLength === duration && elem.rest.type !== 'invisible' && elem.rest.type !== 'spacer' && elem.rest.type.indexOf('multimeasure') < 0)
				elem.rest.type = 'whole';
			const ret1 = addRestToAbsElement(abselem, elem, duration, dot, voice.voicetotal > 1, this.stemdir, isSingleLineStaff, durlog, this.voiceScale);
			notehead = ret1.noteHead;
			roomtaken = ret1.roomTaken;
			roomtakenright = ret1.roomTakenRight;
		} else {
			const ret2 = this.addNoteToAbcElement(abselem, elem, dot, this.stemdir, this.style, zeroDuration, durlog, nostem, voice);
			if (ret2.min !== undefined)
				this.minY = Math.min(ret2.min, this.minY || 999);
			notehead = ret2.noteHead;
			roomtaken = ret2.roomTaken;
			roomtakenright = ret2.roomTakenRight;
			additionalLedgers = ret2.additionalLedgers;
			dir = ret2.dir;
			symbolWidth = ret2.symbolWidth;
		}

		if (elem.lyric !== undefined) {
			this.addLyric(abselem, elem);
		}

		if (elem.gracenotes !== undefined) {
			roomtaken += this.addGraceNotes(elem, voice, abselem, notehead, this.stemHeight * this.voiceScale, this.isBagpipes, roomtaken);
		}

		if (elem.decoration) {
			const bottom = nostem && dir !== 'up' ? Math.min(-3, abselem.bottom - 6) : abselem.bottom;
			this.decoration.createDecoration(voice, elem.decoration, abselem.top, (notehead) ? notehead.w : 0, abselem, roomtaken, dir, bottom, elem.positioning, this.hasVocals, this.accentAbove);
		}

		if (elem.barNumber) {
			abselem.addFixed(new RelativeElement(elem.barNumber, -10, 0, 0, { type: "barNumber" }));
		}

		ledgerLines(abselem, elem.minpitch, elem.maxpitch, elem.rest, symbolWidth, additionalLedgers, dir || "up", -2, 1);

		if (elem.chord !== undefined) {
			const ret3 = addChord(this.getTextSize, abselem, elem, roomtaken, roomtakenright, symbolWidth, this.jazzchords, this.germanAlphabet);
			roomtaken = ret3.roomTaken;
			roomtakenright = ret3.roomTakenRight;
		}

		if (elem.startTriplet) {
			this.triplet = new TripletElem(elem.startTriplet, notehead, { flatBeams: this.flatBeams });
		}

		if (elem.endTriplet && this.triplet) {
			this.triplet.setCloseAnchor(notehead);
		}

		if (this.triplet && !elem.startTriplet && !elem.endTriplet && !(elem.rest && elem.rest.type === "spacer")) {
			this.triplet.middleNote(notehead);
		}

		return abselem;
	}

	public addNoteToAbcElement(abselem: any, elem: any, dot: number, stemdir: string | undefined, style: string | undefined, zeroDuration: boolean, durlog: number, nostem: boolean, voice: any): any {
		let dotshiftx = 0;
		let noteHead: any;
		let roomTaken = 0;
		let roomTakenRight = 0;
		let min: number | undefined;
		let additionalLedgers: number[] = [];
		const accidentalSlot: number[] = [];
		let symbolWidth = 0;

		const dir = (elem.averagepitch >= 6) ? "down" : "up";
		const finalDir = stemdir || dir;

		style = elem.style ? elem.style : style;
		if (!style || style === "normal") style = "note";
		const noteSymbol = zeroDuration ? chartable[style].nostem : chartable[style][-durlog];

		for (let p = (finalDir === "down") ? elem.pitches.length - 2 : 1; (finalDir === "down") ? p >= 0 : p < elem.pitches.length; p = (finalDir === "down") ? p - 1 : p + 1) {
			const prev = elem.pitches[(finalDir === "down") ? p + 1 : p - 1];
			const curr = elem.pitches[p];
			const delta = (finalDir === "down") ? prev.pitch - curr.pitch : curr.pitch - prev.pitch;
			if (delta <= 1 && !prev.printer_shift) {
				curr.printer_shift = (delta) ? "different" : "same";
				if (curr.verticalPos > 11 || curr.verticalPos < 1) {
					additionalLedgers.push(curr.verticalPos - (curr.verticalPos % 2));
				}
				if (finalDir === "down") {
					roomTaken = glyphs.getSymbolWidth(noteSymbol) + 2;
				} else {
					dotshiftx = glyphs.getSymbolWidth(noteSymbol) + 2;
				}
			}
		}

		const pp = elem.pitches.length;
		for (let p = 0; p < elem.pitches.length; p++) {
			let flag: string | null = null;
			if (!nostem) {
				if ((finalDir === "down" && p !== 0) || (finalDir === "up" && p !== pp - 1)) {
					flag = null;
				} else {
					flag = chartable[(finalDir === "down") ? "dflags" : "uflags"][-durlog];
				}
			}
			let c: string;
			if (elem.pitches[p].style) {
				c = chartable[elem.pitches[p].style][-durlog];
			} else if (voice.isPercussion && this.percmap) {
				c = noteSymbol;
				const percHead = this.percmap[pitchesToPerc(elem.pitches[p])];
				if (percHead && percHead.noteHead) {
					if (chartable[percHead.noteHead])
						c = chartable[percHead.noteHead][-durlog];
				}
			} else
				c = noteSymbol;

			(elem.pitches[p] as any).highestVert = elem.pitches[p].verticalPos;
			const isTopWhenStemIsDown = (stemdir === "up" || finalDir === "up") && p === 0;
			const isBottomWhenStemIsUp = (stemdir === "down" || finalDir === "down") && p === pp - 1;
			if (isTopWhenStemIsDown || isBottomWhenStemIsUp) {
				if (elem.startSlur || pp === 1) {
					(elem.pitches[p] as any).highestVert = elem.pitches[pp - 1].verticalPos;
					if (getDuration(elem) < 1 && (stemdir === "up" || finalDir === "up"))
						(elem.pitches[p] as any).highestVert += 6;
				}
				if (elem.startSlur) {
					if (!elem.pitches[p].startSlur) elem.pitches[p].startSlur = [];
					for (let i = 0; i < elem.startSlur.length; i++) {
						addIfNotExist(elem.pitches[p].startSlur, elem.startSlur[i]);
					}
				}

				if (elem.endSlur) {
					(elem.pitches[p] as any).highestVert = elem.pitches[pp - 1].verticalPos;
					if (getDuration(elem) < 1 && (stemdir === "up" || finalDir === "up"))
						(elem.pitches[p] as any).highestVert += 6;
					if (!elem.pitches[p].endSlur) elem.pitches[p].endSlur = [];
					for (let i = 0; i < elem.endSlur.length; i++) {
						addIfNotExist(elem.pitches[p].endSlur, elem.endSlur[i]);
					}
				}
			}

			const hasStem = !nostem && durlog <= -1;
			const ret = createNoteHead(abselem, c, elem.pitches[p],
				{ dir: finalDir, extrax: -roomTaken, flag: flag, dot: dot, dotshiftx: dotshiftx, scale: this.voiceScale, accidentalSlot: accidentalSlot, shouldExtendStem: !stemdir, printAccidentals: !voice.isPercussion });
			symbolWidth = Math.max(glyphs.getSymbolWidth(c), symbolWidth);
			abselem.extraw -= ret.extraLeft;
			noteHead = ret.notehead;
			if (noteHead) {
				this.addSlursAndTies(abselem, elem.pitches[p], noteHead, voice, hasStem ? finalDir : null, false);
				if (elem.gracenotes && elem.gracenotes.length > 0)
					noteHead.bottom = noteHead.bottom - 1;
				abselem.addHead(noteHead);
			}
			roomTaken += ret.accidentalshiftx;
			roomTakenRight = Math.max(roomTakenRight, ret.dotshiftx);
		}

		const hasStemOnChord = !nostem && durlog <= -1;
		if (hasStemOnChord) {
			const stemHeight = Math.round(70 * this.voiceScale) / 10;
			let p1 = (finalDir === "down") ? elem.minpitch - stemHeight : elem.minpitch + 1 / 3;
			if (p1 > 6 && !stemdir) p1 = 6;
			let p2 = (finalDir === "down") ? elem.maxpitch - 1 / 3 : elem.maxpitch + stemHeight;
			if (p2 < 6 && !stemdir) p2 = 6;
			const dx = (finalDir === "down" || abselem.heads.length === 0) ? 0 : abselem.heads[0].w;
			const width = (finalDir === "down") ? 1 : -1;
			if (noteHead && noteHead.c === 'noteheads.slash.quarter') {
				if (finalDir === 'down') p2 -= 1; else p1 += 1;
			}
			if (noteHead && noteHead.c === 'noteheads.triangle.quarter') {
				if (finalDir === 'down') p2 -= 0.7; else p1 -= 1.2;
			}
			abselem.addRight(new RelativeElement(null, dx, 0, p1, { "type": "stem", "pitch2": p2, linewidth: width, bottom: p1 - 1 }));
			min = Math.min(p1, p2);
		}
		return { noteHead: noteHead, roomTaken: roomTaken, roomTakenRight: roomTakenRight, min: min, additionalLedgers: additionalLedgers, dir: finalDir, symbolWidth: symbolWidth };
	}

	public addLyric(abselem: any, elem: any): void {
		let lyricStr = "";
		elem.lyric.forEach((ly: any) => {
			const div = ly.divider === ' ' ? "" : ly.divider;
			lyricStr += ly.syllable + div + "\n";
		});
		const lyricDim = this.getTextSize.calc(lyricStr, 'vocalfont', "lyric");
		const position = elem.positioning ? elem.positioning.vocalPosition : 'below';
		abselem.addCentered(new RelativeElement(lyricStr, 0, lyricDim.width, undefined, { type: "lyric", position: position, height: lyricDim.height / spacing.STEP, dim: this.getTextSize.attr('vocalfont', "lyric") }));
	}

	public addGraceNotes(elem: any, voice: any, abselem: any, notehead: any, stemHeight: number, isBagpipes: boolean, roomtaken: number): number {
		const gracescale = 3 / 5;
		const graceScaleStem = 3.5 / 5;
		stemHeight = Math.round(stemHeight * graceScaleStem);
		let gracebeam: any = null;

		if (elem.gracenotes.length > 1) {
			gracebeam = new BeamElem(stemHeight, "grace", isBagpipes);
			if (hint) gracebeam.setHint();
			gracebeam.mainNote = abselem;
		}

		const graceoffsets: number[] = [];
		for (let i = elem.gracenotes.length - 1; i >= 0; i--) {
			roomtaken += 10;
			graceoffsets[i] = roomtaken;
			if (elem.gracenotes[i].accidental) {
				roomtaken += 7;
			}
		}

		for (let i = 0; i < elem.gracenotes.length; i++) {
			const gracepitch = elem.gracenotes[i].verticalPos;
			const flag = (gracebeam) ? null : chartable.uflags[(isBagpipes) ? 5 : 3];
			const accidentalSlot: number[] = [];
			const ret = createNoteHead(abselem, "noteheads.quarter", elem.gracenotes[i],
				{ dir: "up", headx: -graceoffsets[i], extrax: -graceoffsets[i], flag: flag, scale: gracescale * this.voiceScale, accidentalSlot: accidentalSlot });
			(ret.notehead as any).highestVert = ret.notehead.pitch + stemHeight;
			const grace = ret.notehead;
			this.addSlursAndTies(abselem, elem.gracenotes[i], grace, voice, "up", true);
			abselem.addExtra(grace);

			if (elem.gracenotes[i].acciaccatura) {
				const pos = elem.gracenotes[i].verticalPos + 7 * gracescale;
				const dAcciaccatura = gracebeam ? 5 : 6;
				abselem.addRight(new RelativeElement("flags.ugrace", -graceoffsets[i] + dAcciaccatura, 0, pos, { scalex: gracescale, scaley: gracescale }));
			}
			if (gracebeam) {
				let graceDuration = elem.gracenotes[i].duration / 2;
				if (isBagpipes) graceDuration /= 2;
				const pseudoabselem = {
					heads: [grace],
					abcelem: { averagepitch: gracepitch, minpitch: gracepitch, maxpitch: gracepitch, duration: graceDuration }
				};
				gracebeam.add(pseudoabselem);
			} else {
				const p1 = gracepitch + 1 / 3 * gracescale;
				const p2 = gracepitch + 7 * gracescale;
				const dx = grace.dx + grace.w;
				const width = -0.6;
				abselem.addExtra(new RelativeElement(null, dx, 0, p1, { "type": "stem", "pitch2": p2, linewidth: width }));
			}
			ledgerLines(abselem, gracepitch, gracepitch, false, glyphs.getSymbolWidth("noteheads.quarter"), [], true, grace.dx - 1, 0.6);

			const isInvisibleRest = elem.rest && (elem.rest.type === "spacer" || elem.rest.type === "invisible");
			if (i === 0 && !isBagpipes && this.graceSlurs && !isInvisibleRest) {
				voice.addOther(new TieElem({ anchor1: grace, anchor2: notehead as any, isGrace: true }));
			}
		}

		if (gracebeam) {
			gracebeam.calcDir();
			voice.addBeam(gracebeam);
		}
		return roomtaken;
	}

	public addSlursAndTies(abselem: any, pitchelem: any, notehead: any, voice: any, dir: string | null, isGrace: boolean): void {
		if (pitchelem.endTie) {
			if (this.ties.length > 0) {
				let found = false;
				for (let j = 0; j < this.ties.length; j++) {
					if (this.ties[j].anchor1 && this.ties[j].anchor1.pitch === notehead.pitch) {
						this.ties[j].setEndAnchor(notehead);
						voice.setRange(this.ties[j]);
						this.ties.splice(j, 1);
						found = true;
						break;
					}
				}
				if (!found) {
					this.ties[0].setEndAnchor(notehead);
					voice.setRange(this.ties[0]);
					this.ties.splice(0, 1);
				}
			}
		}

		const voiceNumber = voice.voicetotal < 2 ? -1 : voice.voicenumber;
		if (pitchelem.startTie) {
			const tie = new TieElem({ anchor1: notehead, force: (this.stemdir === "down" || this.stemdir === "up"), stemDir: this.stemdir, isGrace: isGrace, voiceNumber: voiceNumber, style: pitchelem.startTie.style });
			if (hint) tie.setHint();
			this.ties.push(tie);
			voice.addOther(tie);
			abselem.startTie = true;
		}

		let slur: any;
		let slurid: string;
		if (pitchelem.endSlur) {
			for (let i = 0; i < pitchelem.endSlur.length; i++) {
				slurid = pitchelem.endSlur[i];
				if (this.slurs[slurid]) {
					slur = this.slurs[slurid];
					slur.setEndAnchor(notehead);
					voice.setRange(slur);
					delete this.slurs[slurid];
				} else {
					slur = new TieElem({ anchor2: notehead, stemDir: this.stemdir, voiceNumber: voiceNumber });
					if (hint) slur.setHint();
					voice.addOther(slur);
				}
				if (this.startlimitelem) {
					slur.setStartX(this.startlimitelem);
				}
			}
		} else if (!isGrace) {
			for (const s in this.slurs) {
				if (Object.prototype.hasOwnProperty.call(this.slurs, s)) {
					this.slurs[s].addInternalNote(notehead);
				}
			}
		}

		if (pitchelem.startSlur) {
			for (let i = 0; i < pitchelem.startSlur.length; i++) {
				slurid = pitchelem.startSlur[i].label;
				slur = new TieElem({ anchor1: notehead, stemDir: this.stemdir, voiceNumber: voiceNumber, style: pitchelem.startSlur[i].style });
				if (hint) slur.setHint();
				this.slurs[slurid] = slur;
				voice.addOther(slur);
			}
		}
	}

	public addMeasureNumber(number: string, abselem: any): void {
		const measureNumDim = this.getTextSize.calc(number, "measurefont", 'bar-number');
		let dx = 0;
		if (abselem.isClef) dx += measureNumDim.width / 2;
		const vert = measureNumDim.width > 10 && abselem.abcelem.type === "treble" ? 13.5 : 11;
		abselem.addFixed(new RelativeElement(number, dx, measureNumDim.width, vert + measureNumDim.height / spacing.STEP, { type: "barNumber", dim: this.getTextSize.attr("measurefont", 'bar-number') }));
	}

	public createBarLine(voice: any, elem: any, isFirstStaff: boolean): any {
		const abselem = new AbsoluteElement(elem, 0, 10, 'bar', this.tuneNumber);
		let anchor: any = null;
		let dx = 0;

		if (elem.barNumber) {
			this.addMeasureNumber(elem.barNumber, abselem);
		}

		const firstdots = (elem.type === "bar_right_repeat" || elem.type === "bar_dbl_repeat");
		const firstthin = (elem.type !== "bar_left_repeat" && elem.type !== "bar_thick_thin" && elem.type !== "bar_invisible");
		const thick = (elem.type === "bar_right_repeat" || elem.type === "bar_dbl_repeat" || elem.type === "bar_left_repeat" ||
			elem.type === "bar_thin_thick" || elem.type === "bar_thick_thin");
		const secondthin = (elem.type === "bar_left_repeat" || elem.type === "bar_thick_thin" || elem.type === "bar_thin_thin" || elem.type === "bar_dbl_repeat");
		const seconddots = (elem.type === "bar_left_repeat" || elem.type === "bar_dbl_repeat");

		if (firstdots || seconddots) {
			for (const slur in this.slurs) {
				if (Object.prototype.hasOwnProperty.call(this.slurs, slur)) {
					this.slurs[slur].setEndX(abselem);
				}
			}
			this.startlimitelem = abselem;
		}

		if (firstdots) {
			abselem.addRight(new RelativeElement("dots.dot", dx, 1, 7));
			abselem.addRight(new RelativeElement("dots.dot", dx, 1, 5));
			dx += 6;
		}

		if (firstthin) {
			anchor = new RelativeElement(null, dx, 1, 2, { "type": "bar", "pitch2": 10, linewidth: 0.6 });
			abselem.addRight(anchor);
		}

		if (elem.type === "bar_invisible") {
			anchor = new RelativeElement(null, dx, 1, 2, { "type": "none", "pitch2": 10, linewidth: 0.6 });
			abselem.addRight(anchor);
		}

		if (elem.decoration) {
			this.decoration.createDecoration(voice, elem.decoration, 12, (thick) ? 3 : 1, abselem, 0, "down", 2, elem.positioning, this.hasVocals, this.accentAbove);
		}

		if (thick) {
			dx += 4;
			anchor = new RelativeElement(null, dx, 4, 2, { "type": "bar", "pitch2": 10, linewidth: 4 });
			abselem.addRight(anchor);
			dx += 5;
		}

		if (this.partstartelem && elem.endEnding) {
			this.partstartelem.anchor2 = anchor;
			this.partstartelem = null;
		}

		if (secondthin) {
			dx += 3;
			anchor = new RelativeElement(null, dx, 1, 2, { "type": "bar", "pitch2": 10, linewidth: 0.6 });
			abselem.addRight(anchor);
		}

		if (seconddots) {
			dx += 3;
			abselem.addRight(new RelativeElement("dots.dot", dx, 1, 7));
			abselem.addRight(new RelativeElement("dots.dot", dx, 1, 5));
		}

		if (elem.startEnding && isFirstStaff) {
			if (voice.voicenumber === 0) {
				const textWidth = this.getTextSize.calc(elem.startEnding, "repeatfont", '').width;
				abselem.minspacing += textWidth + 10;
				this.partstartelem = new EndingElem(elem.startEnding, anchor, null);
				voice.addOther(this.partstartelem);
			}
		}
		abselem.extraw -= 5;

		if (elem.chord !== undefined) {
			addChord(this.getTextSize, abselem, elem, 0, 0, 0, false, this.germanAlphabet);
		}

		return abselem;
	}
}

const getBeamGroup = (abcline: any[], pos: number): { count: number, elem: any } => {
	const elem = abcline[pos];
	if (elem.el_type !== 'note' || !elem.startBeam || elem.endBeam)
		return { count: 1, elem: elem };

	const group = [];
	while (pos < abcline.length && abcline[pos].el_type === 'note') {
		group.push(abcline[pos]);
		if (abcline[pos].endBeam)
			break;
		pos++;
	}
	return { count: group.length, elem: group };
}

const setAveragePitch = (elem: any): void => {
	if (elem.pitches) {
		sortPitch(elem);
		let sum = 0;
		for (let p = 0; p < elem.pitches.length; p++) {
			sum += elem.pitches[p].verticalPos;
		}
		elem.averagepitch = sum / elem.pitches.length;
		elem.minpitch = elem.pitches[0].verticalPos;
		elem.maxpitch = elem.pitches[elem.pitches.length - 1].verticalPos;
	}
}

const sortPitch = (elem: any): void => {
	let sorted;
	do {
		sorted = true;
		for (let p = 0; p < elem.pitches.length - 1; p++) {
			if (elem.pitches[p].pitch > elem.pitches[p + 1].pitch) {
				sorted = false;
				const tmp = elem.pitches[p];
				elem.pitches[p] = elem.pitches[p + 1];
				elem.pitches[p + 1] = tmp;
			}
		}
	} while (!sorted);
};

const ledgerLines = (abselem: any, minPitch: number, maxPitch: number, isRest: boolean, symbolWidth: number, additionalLedgers: number[], dir: string | boolean, dx: number, scale: number): void => {
	for (let i = maxPitch; i > 11; i--) {
		if (i % 2 === 0 && !isRest) {
			abselem.addFixed(new RelativeElement(null, dx, (symbolWidth + 4) * scale, i, { type: "ledger" }));
		}
	}

	for (let i = minPitch; i < 1; i++) {
		if (i % 2 === 0 && !isRest) {
			abselem.addFixed(new RelativeElement(null, dx, (symbolWidth + 4) * scale, i, { type: "ledger" }));
		}
	}

	for (let i = 0; i < additionalLedgers.length; i++) {
		let ofs = symbolWidth;
		if (dir === 'down') ofs = -ofs;
		abselem.addFixed(new RelativeElement(null, ofs + dx, (symbolWidth + 4) * scale, additionalLedgers[i], { type: "ledger" }));
	}
};

const addRestToAbsElement = (abselem: any, elem: any, duration: number, dot: number, isMultiVoice: boolean, stemdir: string | undefined, isSingleLineStaff: boolean, durlog: number, voiceScale: number): any => {
	let c: string = "";
	let restpitch = 7;
	let noteHead: any;
	let roomTaken: number = 0;
	let roomTakenRight: number = 0;

	if (isMultiVoice) {
		if (stemdir === "down") restpitch = 3;
		if (stemdir === "up") restpitch = 11;
	}
	if (isSingleLineStaff) {
		if (duration < 0.5) restpitch = 7;
		else if (duration < 1) restpitch = 7;
		else restpitch = 5;
	}
	switch (elem.rest.type) {
		case "whole":
			c = chartable.rest[0];
			elem.averagepitch = restpitch;
			elem.minpitch = restpitch;
			elem.maxpitch = restpitch;
			dot = 0;
			break;
		case "rest":
			if (elem.style === "rhythm") c = chartable.rhythm[-durlog];
			else c = chartable.rest[-durlog];
			elem.averagepitch = restpitch;
			elem.minpitch = restpitch;
			elem.maxpitch = restpitch;
			break;
		case "invisible":
		case "invisible-multimeasure":
		case "spacer":
			c = "";
			elem.averagepitch = restpitch;
			elem.minpitch = restpitch;
			elem.maxpitch = restpitch;
			break;
		case "multimeasure":
			c = chartable.rest['multi'];
			elem.averagepitch = restpitch;
			elem.minpitch = restpitch;
			elem.maxpitch = restpitch;
			dot = 0;
			const mmWidth = glyphs.getSymbolWidth(c);
			abselem.addHead(new RelativeElement(c, mmWidth, mmWidth * 2, 7));
			const numMeasures = new RelativeElement("" + elem.rest.text, mmWidth, mmWidth, 16, { type: "multimeasure-text" });
			abselem.addExtra(numMeasures);
	}
	if (elem.rest.type.indexOf("multimeasure") < 0 && elem.rest.type !== "invisible") {
		const ret = createNoteHead(abselem, c, { verticalPos: restpitch },
			{ dot: dot, scale: voiceScale });
		noteHead = ret.notehead;
		if (noteHead) {
			abselem.addHead(noteHead);
			roomTaken = ret.accidentalshiftx;
			roomTakenRight = ret.dotshiftx;
		}
	}
	return { noteHead: noteHead, roomTaken: roomTaken, roomTakenRight: roomTakenRight };
}

const addIfNotExist = (arr: any[], item: any): void => {
	for (let i = 0; i < arr.length; i++) {
		if (JSON.stringify(arr[i]) === JSON.stringify(item))
			return;
	}
	arr.push(item);
}

export default AbstractEngraver;
