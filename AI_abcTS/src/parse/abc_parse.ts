import parseCommon from './abc_common';
import parseDirective from './abc_parse_directive';
import ParseHeader from './abc_parse_header';
import ParseMusic from './abc_parse_music';
import Tokenizer from './abc_tokenizer';
import { wrapLines } from './wrap_lines';
import chordGrid from './chord-grid';

import { TuneObject } from 'abcjs';
import Tune from '../data/abc_tune';
import TuneBuilder from '../parse/tune-builder';

export default class Parse {
	private tune: Tune;
	private tuneBuilder: TuneBuilder;
	private tokenizer: Tokenizer;
	private wordsContinuation: string = '';
	private symbolContinuation: string = '';
	private header: ParseHeader;
	private music: any;
	private multilineVars: { [key: string]: any };

	constructor() {
		this.tune = new Tune();
		this.tuneBuilder = new TuneBuilder(this.tune);
		this.wordsContinuation = '';
		this.symbolContinuation = '';

		this.multilineVars = {
			reset: () => {
				for (const property in this.multilineVars) {
					if (Object.prototype.hasOwnProperty.call(this.multilineVars, property) && typeof this.multilineVars[property] !== "function") {
						delete this.multilineVars[property];
					}
				}
				this.multilineVars.iChar = 0;
				this.multilineVars.key = { accidentals: [], root: 'none', acc: '', mode: '' };
				this.multilineVars.meter = null;
				this.multilineVars.origMeter = null;
				this.multilineVars.hasMainTitle = false;
				this.multilineVars.default_length = 0.125;
				this.multilineVars.clef = { type: 'treble', verticalPos: 0 };
				this.multilineVars.octave = 0;
				this.multilineVars.next_note_duration = 0;
				this.multilineVars.start_new_line = true;
				this.multilineVars.is_in_header = true;
				this.multilineVars.partForNextLine = {};
				this.multilineVars.tempoForNextLine = [];
				this.multilineVars.havent_set_length = true;
				this.multilineVars.voices = {};
				this.multilineVars.staves = [];
				this.multilineVars.macros = {};
				this.multilineVars.currBarNumber = 1;
				this.multilineVars.barCounter = {};
				this.multilineVars.ignoredDecorations = [];
				this.multilineVars.score_is_present = false;
				this.multilineVars.inEnding = false;
				this.multilineVars.inTie = [];
				this.multilineVars.inTieChord = {};
				this.multilineVars.vocalPosition = "auto";
				this.multilineVars.dynamicPosition = "auto";
				this.multilineVars.chordPosition = "auto";
				this.multilineVars.ornamentPosition = "auto";
				this.multilineVars.volumePosition = "auto";
				this.multilineVars.openSlurs = [];
				this.multilineVars.freegchord = false;
				this.multilineVars.endingHoldOver = {};
			},
			differentFont: (type: string, defaultFonts: any) => {
				if (this.multilineVars[type].decoration !== defaultFonts[type].decoration) return true;
				if (this.multilineVars[type].face !== defaultFonts[type].face) return true;
				if (this.multilineVars[type].size !== defaultFonts[type].size) return true;
				if (this.multilineVars[type].style !== defaultFonts[type].style) return true;
				if (this.multilineVars[type].weight !== defaultFonts[type].weight) return true;
				return false;
			},
			addFormattingOptions: (el: any, defaultFonts: any, elType: string) => {
				if (elType === 'note') {
					if (this.multilineVars.vocalPosition !== 'auto') this.addPositioning(el, 'vocalPosition', this.multilineVars.vocalPosition);
					if (this.multilineVars.dynamicPosition !== 'auto') this.addPositioning(el, 'dynamicPosition', this.multilineVars.dynamicPosition);
					if (this.multilineVars.chordPosition !== 'auto') this.addPositioning(el, 'chordPosition', this.multilineVars.chordPosition);
					if (this.multilineVars.ornamentPosition !== 'auto') this.addPositioning(el, 'ornamentPosition', this.multilineVars.ornamentPosition);
					if (this.multilineVars.volumePosition !== 'auto') this.addPositioning(el, 'volumePosition', this.multilineVars.volumePosition);
					if (this.multilineVars.differentFont("annotationfont", defaultFonts)) this.addFont(el, 'annotationfont', this.multilineVars.annotationfont);
					if (this.multilineVars.differentFont("gchordfont", defaultFonts)) this.addFont(el, 'gchordfont', this.multilineVars.gchordfont);
					if (this.multilineVars.differentFont("vocalfont", defaultFonts)) this.addFont(el, 'vocalfont', this.multilineVars.vocalfont);
					if (this.multilineVars.differentFont("tripletfont", defaultFonts)) this.addFont(el, 'tripletfont', this.multilineVars.tripletfont);
				} else if (elType === 'bar') {
					if (this.multilineVars.dynamicPosition !== 'auto') this.addPositioning(el, 'dynamicPosition', this.multilineVars.dynamicPosition);
					if (this.multilineVars.chordPosition !== 'auto') this.addPositioning(el, 'chordPosition', this.multilineVars.chordPosition);
					if (this.multilineVars.ornamentPosition !== 'auto') this.addPositioning(el, 'ornamentPosition', this.multilineVars.ornamentPosition);
					if (this.multilineVars.volumePosition !== 'auto') this.addPositioning(el, 'volumePosition', this.multilineVars.volumePosition);
					if (this.multilineVars.differentFont("measurefont", defaultFonts)) this.addFont(el, 'measurefont', this.multilineVars.measurefont);
					if (this.multilineVars.differentFont("repeatfont", defaultFonts)) this.addFont(el, 'repeatfont', this.multilineVars.repeatfont);
				}
			},
			duplicateStartEndingHoldOvers: () => {
				this.multilineVars.endingHoldOver = {
					inTie: [],
					inTieChord: {}
				};
				for (let i = 0; i < this.multilineVars.inTie.length; i++) {
					this.multilineVars.endingHoldOver.inTie.push([]);
					if (this.multilineVars.inTie[i]) {
						for (let j = 0; j < this.multilineVars.inTie[i].length; j++) {
							this.multilineVars.endingHoldOver.inTie[i].push(this.multilineVars.inTie[i][j]);
						}
					}
				}
				for (const key in this.multilineVars.inTieChord) {
					if (Object.prototype.hasOwnProperty.call(this.multilineVars.inTieChord, key))
						this.multilineVars.endingHoldOver.inTieChord[key] = this.multilineVars.inTieChord[key];
				}
			},
			restoreStartEndingHoldOvers: () => {
				if (!this.multilineVars.endingHoldOver.inTie)
					return;
				this.multilineVars.inTie = [];
				this.multilineVars.inTieChord = {};
				for (let i = 0; i < this.multilineVars.endingHoldOver.inTie.length; i++) {
					this.multilineVars.inTie.push([]);
					for (let j = 0; j < this.multilineVars.endingHoldOver.inTie[i].length; j++) {
						this.multilineVars.inTie[i].push(this.multilineVars.endingHoldOver.inTie[i][j]);
					}
				}
				for (const key in this.multilineVars.endingHoldOver.inTieChord) {
					if (Object.prototype.hasOwnProperty.call(this.multilineVars.endingHoldOver.inTieChord, key))
						this.multilineVars.inTieChord[key] = this.multilineVars.endingHoldOver.inTieChord[key];
				}
			},
		};
	}

	public getTune(): TuneObject {
		const t: TuneObject = {
			formatting: this.tune.formatting,
			lines: this.tune.lines,
			media: this.tune.media,
			metaText: this.tune.metaText,
			metaTextInfo: this.tune.metaTextInfo,
			version: this.tune.version,

			addElementToEvents: this.tune.addElementToEvents,
			addUsefulCallbackInfo: this.tune.addUsefulCallbackInfo,
			getTotalTime: this.tune.getTotalTime,
			getTotalBeats: this.tune.getTotalBeats,
			getBarLength: this.tune.getBarLength,
			getBeatLength: this.tune.getBeatLength,
			getBeatsPerMeasure: this.tune.getBeatsPerMeasure,
			getBpm: this.tune.getBpm,
			getMeter: this.tune.getMeter,
			getMeterFraction: this.tune.getMeterFraction,
			getPickupLength: this.tune.getPickupLength,
			getKeySignature: this.tune.getKeySignature,
			getElementFromChar: this.tune.getElementFromChar,
			makeVoicesArray: this.tune.makeVoicesArray,
			millisecondsPerMeasure: this.tune.millisecondsPerMeasure,
			setupEvents: this.tune.setupEvents,
			setTiming: this.tune.setTiming,
			setUpAudio: this.tune.setUpAudio,
			deline: this.tune.deline,
			findSelectableElement: this.tune.findSelectableElement,
			getSelectableArray: this.tune.getSelectableArray,
		};
		if (this.tune.lineBreaks)
			t.lineBreaks = this.tune.lineBreaks;
		if (this.tune.visualTranspose)
			t.visualTranspose = this.tune.visualTranspose;
		if (this.tune.chordGrid)
			t.chordGrid = this.tune.chordGrid;
		return t;
	}

	private addPositioning(el: any, type: string, value: any) {
		if (!el.positioning) el.positioning = {};
		el.positioning[type] = value;
	}

	private addFont(el: any, type: string, value: any) {
		if (!el.fonts) el.fonts = {};
		el.fonts[type] = value;
	}

	private addWarning = (str: string) => {
		if (!this.multilineVars.warnings)
			this.multilineVars.warnings = [];
		this.multilineVars.warnings.push(str);
	};

	private addWarningObject = (warningObject: any) => {
		if (!this.multilineVars.warningObjects)
			this.multilineVars.warningObjects = [];
		this.multilineVars.warningObjects.push(warningObject);
	};

	private encode = (str: string) => {
		let ret = str.replace(/\x12/g, ' ');
		ret = ret.replace(/&/g, '&amp;');
		ret = ret.replace(/</g, '&lt;');
		return ret.replace(/>/g, '&gt;');
	};

	private warn = (str: string, line: string, col_num: number) => {
		if (!line) line = " ";
		let bad_char = line[col_num];
		if (bad_char === ' ' || !bad_char)
			bad_char = "SPACE";
		const clean_line = this.encode(line.substring(col_num - 64, col_num)) + '<span style="text-decoration:underline;font-size:1.3em;font-weight:bold;">' + bad_char + '</span>' + this.encode(line.substring(col_num + 1).substring(0, 64));
		this.addWarning("Music Line:" + this.tokenizer.lineIndex + ":" + (col_num + 1) + ': ' + str + ":  " + clean_line);
		this.addWarningObject({ message: str, line: line, startChar: this.multilineVars.iChar + col_num, column: col_num });
	};

	public getWarnings() {
		return this.multilineVars.warnings;
	}
	public getWarningObjects() {
		return this.multilineVars.warningObjects;
	}

	private addWords = (line: any[], words: string) => {
		if (words.indexOf('\x12') >= 0) {
			this.wordsContinuation += words;
			return;
		}
		words = this.wordsContinuation + words;
		this.wordsContinuation = '';

		if (!line) { this.warn("Can't add words before the first line of music", line as any, 0); return; }
		words = parseCommon.strip(words);
		if (words[words.length - 1] !== '-')
			words = words + ' ';
		const word_list: any[] = [];
		let last_divider = 0;
		let replace = false;
		const addWord = (i: number) => {
			let word = parseCommon.strip(words.substring(last_divider, i));
			word = word.replace(/\\([-_*|~])/g, '$1');
			last_divider = i + 1;
			if (word.length > 0) {
				if (replace)
					word = word.replace(/~/g, ' ');
				let div = words[i];
				if (div !== '_' && div !== '-')
					div = ' ';
				word_list.push({ syllable: this.tokenizer.translateString(word), divider: div });
				replace = false;
				return true;
			}
			return false;
		};
		let escNext = false;
		for (let i = 0; i < words.length; i++) {
			switch (words[i]) {
				case ' ':
				case '\x12':
					addWord(i);
					break;
				case '-':
					if (!escNext && !addWord(i) && word_list.length > 0) {
						parseCommon.last(word_list).divider = '-';
						word_list.push({ skip: true, to: 'next' });
					}
					break;
				case '_':
					if (!escNext) {
						addWord(i);
						word_list.push({ skip: true, to: 'slur' });
					}
					break;
				case '*':
					if (!escNext) {
						addWord(i);
						word_list.push({ skip: true, to: 'next' });
					}
					break;
				case '|':
					if (!escNext) {
						addWord(i);
						word_list.push({ skip: true, to: 'bar' });
					}
					break;
				case '~':
					if (!escNext) {
						replace = true;
					}
					break;
			}
			escNext = words[i] === '\\';
		}

		let inSlur = false;
		line.forEach((el) => {
			if (word_list.length !== 0) {
				if (word_list[0].skip) {
					switch (word_list[0].to) {
						case 'next': if (el.el_type === 'note' && el.pitches !== null && !inSlur) word_list.shift(); break;
						case 'slur': if (el.el_type === 'note' && el.pitches !== null) word_list.shift(); break;
						case 'bar': if (el.el_type === 'bar') word_list.shift(); break;
					}
					if (el.el_type !== 'bar') {
						if (el.lyric === undefined)
							el.lyric = [{ syllable: "", divider: " " }];
						else
							el.lyric.push({ syllable: "", divider: " " });
					}
				} else {
					if (el.el_type === 'note' && el.rest === undefined && !inSlur) {
						const lyric = word_list.shift();
						if (lyric.syllable)
							lyric.syllable = lyric.syllable.replace(/ +/g, '\xA0');
						if (el.lyric === undefined)
							el.lyric = [lyric];
						else
							el.lyric.push(lyric);
					}
				}
			}
		});
	};

	private addSymbols = (line: any[], words: string) => {
		if (words.indexOf('\x12') >= 0) {
			this.symbolContinuation += words;
			return;
		}
		words = this.symbolContinuation + words;
		this.symbolContinuation = '';

		if (!line) { this.warn("Can't add symbols before the first line of music", line as any, 0); return; }
		words = parseCommon.strip(words);
		if (words[words.length - 1] !== '-')
			words = words + ' ';
		const word_list: any[] = [];
		let last_divider = 0;
		let replace = false;
		const addWord = (i: number) => {
			let word = parseCommon.strip(words.substring(last_divider, i));
			last_divider = i + 1;
			if (word.length > 0) {
				if (replace)
					word = word.replace(/~/g, ' ');
				let div = words[i];
				if (div !== '_' && div !== '-')
					div = ' ';
				word_list.push({ syllable: this.tokenizer.translateString(word), divider: div });
				replace = false;
				return true;
			}
			return false;
		};
		for (let i = 0; i < words.length; i++) {
			switch (words[i]) {
				case ' ':
				case '\x12':
					addWord(i);
					break;
				case '-':
					if (!addWord(i) && word_list.length > 0) {
						parseCommon.last(word_list).divider = '-';
						word_list.push({ skip: true, to: 'next' });
					}
					break;
				case '_':
					addWord(i);
					word_list.push({ skip: true, to: 'slur' });
					break;
				case '*':
					addWord(i);
					word_list.push({ skip: true, to: 'next' });
					break;
				case '|':
					addWord(i);
					word_list.push({ skip: true, to: 'bar' });
					break;
				case '~':
					replace = true;
					break;
			}
		}

		let inSlur = false;
		line.forEach((el) => {
			if (word_list.length !== 0) {
				if (word_list[0].skip) {
					switch (word_list[0].to) {
						case 'next': if (el.el_type === 'note' && el.pitches !== null && !inSlur) word_list.shift(); break;
						case 'slur': if (el.el_type === 'note' && el.pitches !== null) word_list.shift(); break;
						case 'bar': if (el.el_type === 'bar') word_list.shift(); break;
					}
				} else {
					if (el.el_type === 'note' && el.rest === undefined && !inSlur) {
						const lyric = word_list.shift();
						if (el.lyric === undefined)
							el.lyric = [lyric];
						else
							el.lyric.push(lyric);
					}
				}
			}
		});
	};

	private parseLine = (line: string) => {
		if (parseCommon.startsWith(line, '%%')) {
			const err = parseDirective.addDirective(line.substring(2));
			if (err) this.warn(err, line, 2);
			return;
		}

		let i = line.indexOf('%');
		if (i >= 0)
			line = line.substring(0, i);
		line = line.replace(/\s+$/, '');

		if (line.length === 0)
			return;

		if (this.wordsContinuation) {
			this.addWords(this.tuneBuilder.getCurrentVoice(), line.substring(2));
			return;
		}
		if (this.symbolContinuation) {
			this.addSymbols(this.tuneBuilder.getCurrentVoice(), line.substring(2));
			return;
		}
		if (line.length < 2 || line[1] !== ':' || this.music.lineContinuation) {
			this.music.parseMusic(line);
			return;
		}

		const ret = this.header.parseHeader(line);
		if (ret.regular)
			this.music.parseMusic(line);
		if (ret.newline)
			this.music.startNewLine();
		if (ret.words)
			this.addWords(this.tuneBuilder.getCurrentVoice(), line.substring(2));
		if (ret.symbols)
			this.addSymbols(this.tuneBuilder.getCurrentVoice(), line.substring(2));
	};

	private appendLastMeasure = (voice: any[], nextVoice: any[]) => {
		voice.push({
			el_type: 'hint'
		});
		for (let i = 0; i < nextVoice.length; i++) {
			const element = nextVoice[i];
			const hint = Object.assign({}, element);
			voice.push(hint);
			if (element.el_type === 'bar')
				return;
		}
	};

	private addHintMeasure = (staff: any[], nextStaff: any[]) => {
		for (let i = 0; i < staff.length; i++) {
			const stave = staff[i];
			const nextStave = nextStaff[i];
			if (nextStave) {
				for (let j = 0; j < nextStave.voices.length; j++) {
					const nextVoice = nextStave.voices[j];
					const voice = stave.voices[j];
					if (voice) {
						this.appendLastMeasure(voice, nextVoice);
					}
				}
			}
		}
	};

	private addHintMeasures = () => {
		for (let i = 0; i < this.tune.lines.length; i++) {
			const line = this.tune.lines[i].staff;
			if (line) {
				let j = i + 1;
				while (j < this.tune.lines.length && this.tune.lines[j].staff === undefined)
					j++;
				if (j < this.tune.lines.length) {
					const nextLine = this.tune.lines[j].staff;
					this.addHintMeasure(line, nextLine);
				}
			}
		}
	};

	public parse(strTune: string, switches?: any, startPos?: number) {
		if (!switches) switches = {};
		if (!startPos) startPos = 0;
		this.tune.reset();

		strTune = strTune.replace(/\r\n?/g, '\n') + '\n';

		const arr = strTune.split("\n\\");
		if (arr.length > 1) {
			for (let i2 = 1; i2 < arr.length; i2++) {
				while (arr[i2].length > 0 && arr[i2][0] !== "\n") {
					arr[i2] = arr[i2].substr(1);
					arr[i2 - 1] += ' ';
				}
			}
			strTune = arr.join("  ");
		}
		strTune = strTune.replace(/\\([ \t]*)(%.*)*\n/g, function (all, backslash, comment) {
			const padding = comment ? Array(comment.length + 1).join(' ') : "";
			return backslash + "\x12" + padding + '\n';
		});
		const lines = strTune.split('\n');
		if (parseCommon.last(lines).length === 0)
			lines.pop();
		this.tokenizer = new Tokenizer(lines, this.multilineVars);
		this.header = new ParseHeader(this.tokenizer, this.warn, this.multilineVars, this.tune, this.tuneBuilder);
		this.music = new ParseMusic(this.tokenizer, this.warn, this.multilineVars, this.tune, this.tuneBuilder, this.header);

		if (switches.print)
			this.tune.media = 'print';
		this.multilineVars.reset();
		this.multilineVars.iChar = startPos;
		if (switches.visualTranspose) {
			this.multilineVars.globalTranspose = parseInt(switches.visualTranspose, 10);
			if (this.multilineVars.globalTranspose === 0)
				this.multilineVars.globalTranspose = undefined;
			else
				this.tuneBuilder.setVisualTranspose(switches.visualTranspose);
		} else
			this.multilineVars.globalTranspose = undefined;
		if (switches.lineBreaks) {
			this.multilineVars.lineBreaks = switches.lineBreaks;
		}
		this.header.reset(this.tokenizer, this.warn, this.multilineVars, this.tune, this.tuneBuilder);

		try {
			if (switches.format) {
				parseDirective.globalFormatting(switches.format);
			}
			let line = this.tokenizer.nextLine();
			while (line) {
				if (switches.header_only && this.multilineVars.is_in_header === false)
					throw "normal_abort";
				if (switches.stop_on_warning && this.multilineVars.warnings)
					throw "normal_abort";

				const wasInHeader = this.multilineVars.is_in_header;
				this.parseLine(line);
				if (wasInHeader && !this.multilineVars.is_in_header) {
					this.tuneBuilder.setRunningFont("annotationfont", this.multilineVars.annotationfont);
					this.tuneBuilder.setRunningFont("gchordfont", this.multilineVars.gchordfont);
					this.tuneBuilder.setRunningFont("tripletfont", this.multilineVars.tripletfont);
					this.tuneBuilder.setRunningFont("vocalfont", this.multilineVars.vocalfont);
				}
				line = this.tokenizer.nextLine();
			}

			if (this.wordsContinuation) {
				this.addWords(this.tuneBuilder.getCurrentVoice(), '');
			}
			if (this.symbolContinuation) {
				this.addSymbols(this.tuneBuilder.getCurrentVoice(), '');
			}
			this.multilineVars.openSlurs = this.tuneBuilder.cleanUp(this.multilineVars.barsperstaff, this.multilineVars.staffnonote, this.multilineVars.openSlurs);

		} catch (err) {
			if (err !== "normal_abort")
				throw err;
		}

		let ph = 11 * 72;
		let pl = 8.5 * 72;
		switch (this.multilineVars.papersize) {
			case "legal": ph = 14 * 72; pl = 8.5 * 72; break;
			case "A4": ph = 11.7 * 72; pl = 8.3 * 72; break;
		}
		if (this.multilineVars.landscape) {
			const x = ph;
			ph = pl;
			pl = x;
		}
		if (!this.tune.formatting.pagewidth)
			this.tune.formatting.pagewidth = pl;
		if (!this.tune.formatting.pageheight)
			this.tune.formatting.pageheight = ph;

		if (switches.hint_measures) {
			this.addHintMeasures();
		}

		wrapLines(this.tune, this.multilineVars.lineBreaks, this.multilineVars.barNumbers);
		if (switches.chordGrid) {
			try {
				this.tune.chordGrid = chordGrid(this.tune);
			} catch (err: any) {
				switch (err.message) {
					case "notCommonTime":
						this.warn("Chord grid only works for 2/2 and 4/4 time.", "0", 0);
						break;
					case "noChords":
						this.warn("No chords are found in the tune.", "0", 0);
						break;
					default:
						this.warn(err.message, "0", 0);
				}

			}
		}
	}
}
