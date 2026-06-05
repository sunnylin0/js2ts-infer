import parseCommon from './abc_common';
import parseDirective from './abc_parse_directive';
import parseKeyVoice from './abc_parse_key_voice';

export default class ParseHeader {
	private tokenizer: any;
	private warn: any;
	private multilineVars: any;
	private tune: any;
	private tuneBuilder: any;

	constructor(tokenizer: any, warn: any, multilineVars: any, tune: any, tuneBuilder: any) {
		this.reset(tokenizer, warn, multilineVars, tune, tuneBuilder);
	}

	public reset(tokenizer: any, warn: any, multilineVars: any, tune: any, tuneBuilder?: any) {
		this.tokenizer = tokenizer;
		this.warn = warn;
		this.multilineVars = multilineVars;
		this.tune = tune;
		if (tuneBuilder) {
			this.tuneBuilder = tuneBuilder;
		}
		parseKeyVoice.initialize(this.tokenizer, this.warn, this.multilineVars, this.tune, this.tuneBuilder);
		parseDirective.initialize(this.tokenizer, this.warn, this.multilineVars, this.tune, this.tuneBuilder);
	}

	public setTitle(title: string, origSize: number) {
		if (this.multilineVars.hasMainTitle)
			this.tuneBuilder.addSubtitle(title, { startChar: this.multilineVars.iChar, endChar: this.multilineVars.iChar + origSize + 2 });
		else {
			this.tuneBuilder.addMetaText("title", title, { startChar: this.multilineVars.iChar, endChar: this.multilineVars.iChar + origSize + 2 });
			this.multilineVars.hasMainTitle = true;
		}
	}

	public setMeter(line: string): any {
		line = this.tokenizer.stripComment(line);
		if (line === 'C') {
			if (this.multilineVars.havent_set_length === true) {
				this.multilineVars.default_length = 0.125;
				this.multilineVars.havent_set_length = false;
			}
			return { type: 'common_time' };
		} else if (line === 'C|') {
			if (this.multilineVars.havent_set_length === true) {
				this.multilineVars.default_length = 0.125;
				this.multilineVars.havent_set_length = false;
			}
			return { type: 'cut_time' };
		} else if (line === 'o') {
			if (this.multilineVars.havent_set_length === true) {
				this.multilineVars.default_length = 0.125;
				this.multilineVars.havent_set_length = false;
			}
			return { type: 'tempus_perfectum' };
		} else if (line === 'c') {
			if (this.multilineVars.havent_set_length === true) {
				this.multilineVars.default_length = 0.125;
				this.multilineVars.havent_set_length = false;
			}
			return { type: 'tempus_imperfectum' };
		} else if (line === 'o.') {
			if (this.multilineVars.havent_set_length === true) {
				this.multilineVars.default_length = 0.125;
				this.multilineVars.havent_set_length = false;
			}
			return { type: 'tempus_perfectum_prolatio' };
		} else if (line === 'c.') {
			if (this.multilineVars.havent_set_length === true) {
				this.multilineVars.default_length = 0.125;
				this.multilineVars.havent_set_length = false;
			}
			return { type: 'tempus_imperfectum_prolatio' };
		} else if (line.length === 0 || line.toLowerCase() === 'none') {
			if (this.multilineVars.havent_set_length === true) {
				this.multilineVars.default_length = 0.125;
				this.multilineVars.havent_set_length = false;
			}
			return null;
		} else {
			const tokens = this.tokenizer.tokenize(line, 0, line.length);
			try {
				const parseNum = () => {
					const ret = { value: 0, num: "" };

					let tok = tokens.shift();
					if (tok.token === '(')
						tok = tokens.shift();
					while (1) {
						if (tok.type !== 'number') throw "Expected top number of meter";
						ret.value += parseInt(tok.token, 10);
						ret.num += tok.token;
						if (tokens.length === 0 || tokens[0].token === '/') return ret;
						tok = tokens.shift();
						if (tok.token === ')') {
							if (tokens.length === 0 || tokens[0].token === '/') return ret;
							throw "Unexpected paren in meter";
						}
						if (tok.token !== '.' && tok.token !== '+') throw "Expected top number of meter";
						ret.num += tok.token;
						if (tokens.length === 0) throw "Expected top number of meter";
						tok = tokens.shift();
					}
					return ret;
				};

				const parseFraction = () => {
					const ret: any = parseNum();
					if (tokens.length === 0) return ret;
					let tok = tokens.shift();
					if (tok.token !== '/') throw "Expected slash in meter";
					tok = tokens.shift();
					if (tok.type !== 'number') throw "Expected bottom number of meter";
					ret.den = tok.token;
					ret.value = ret.value / parseInt(ret.den, 10);
					return ret;
				};

				if (tokens.length === 0) throw "Expected meter definition in M: line";
				const meter: any = { type: 'specified', value: [] };
				let totalLength = 0;
				while (1) {
					const ret = parseFraction();
					totalLength += ret.value;
					const mv: any = { num: ret.num };
					if (ret.den !== undefined)
						mv.den = ret.den;
					meter.value.push(mv);
					if (tokens.length === 0) break;
				}

				if (this.multilineVars.havent_set_length === true) {
					this.multilineVars.default_length = totalLength < 0.75 ? 0.0625 : 0.125;
					this.multilineVars.havent_set_length = false;
				}
				return meter;
			} catch (e) {
				this.warn(e, line, 0);
			}
		}
		return null;
	}

	public calcTempo(relTempo: any): any {
		let dur = 1 / 4;
		if (this.multilineVars.meter && this.multilineVars.meter.type === 'specified') {
			dur = 1 / parseInt(this.multilineVars.meter.value[0].den, 10);
		} else if (this.multilineVars.origMeter && this.multilineVars.origMeter.type === 'specified') {
			dur = 1 / parseInt(this.multilineVars.origMeter.value[0].den, 10);
		}
		for (let i = 0; i < relTempo.duration.length; i++)
			relTempo.duration[i] = dur * relTempo.duration[i];
		return relTempo;
	}

	public resolveTempo() {
		if (this.multilineVars.tempo) {
			this.calcTempo(this.multilineVars.tempo);
			this.tune.metaText.tempo = this.multilineVars.tempo;
			delete this.multilineVars.tempo;
		}
	}

	public addUserDefinition(line: string, start: number, end: number) {
		const equals = line.indexOf('=', start);
		if (equals === -1) {
			this.warn("Need an = in a macro definition", line, start);
			return;
		}

		const before = parseCommon.strip(line.substring(start, equals));
		const after = parseCommon.strip(line.substring(equals + 1));

		if (before.length !== 1) {
			this.warn("Macro definitions can only be one character", line, start);
			return;
		}
		const legalChars = "HIJKLMNOPQRSTUVWXYhijklmnopqrstuvw~";
		if (legalChars.indexOf(before) === -1) {
			this.warn("Macro definitions must be H-Y, h-w, or tilde", line, start);
			return;
		}
		if (after.length === 0) {
			this.warn("Missing macro definition", line, start);
			return;
		}
		if (this.multilineVars.macros === undefined)
			this.multilineVars.macros = {};
		this.multilineVars.macros[before] = after;
	}

	public setDefaultLength(line: string, start: number, end: number) {
		const len = line.substring(start, end).replace(/ /g, "");
		const len_arr = len.split('/');
		if (len_arr.length === 2) {
			const n = parseInt(len_arr[0], 10);
			const d = parseInt(len_arr[1], 10);
			if (d > 0) {
				this.multilineVars.default_length = n / d;
				this.multilineVars.havent_set_length = false;
			}
		} else if (len_arr.length === 1 && len_arr[0] === '1') {
			this.multilineVars.default_length = 1;
			this.multilineVars.havent_set_length = false;
		}
	}

	private tempoString: { [key: string]: number } = {
		larghissimo: 20,
		adagissimo: 24,
		sostenuto: 28,
		grave: 32,
		largo: 40,
		lento: 50,
		larghetto: 60,
		adagio: 68,
		adagietto: 74,
		andante: 80,
		andantino: 88,
		"marcia moderato": 84,
		"andante moderato": 100,
		moderato: 112,
		allegretto: 116,
		"allegro moderato": 120,
		allegro: 126,
		animato: 132,
		agitato: 140,
		veloce: 148,
		"mosso vivo": 156,
		vivace: 164,
		vivacissimo: 172,
		allegrissimo: 176,
		presto: 184,
		prestissimo: 210,
	};

	public setTempo(line: string, start: number, end: number, iChar: number): any {
		try {
			const tokens = this.tokenizer.tokenize(line, start, end);

			if (tokens.length === 0) throw "Missing parameter in Q: field";

			const tempo: any = { startChar: iChar + start - 2, endChar: iChar + end };
			let delaySet = true;
			let token = tokens.shift();
			if (token.type === 'quote') {
				tempo.preString = token.token;
				token = tokens.shift();
				if (tokens.length === 0) {
					if (this.tempoString[tempo.preString.toLowerCase()]) {
						tempo.bpm = this.tempoString[tempo.preString.toLowerCase()];
						tempo.suppressBpm = true;
					}
					return { type: 'immediate', tempo: tempo };
				}
			}
			if (token.type === 'alpha' && token.token === 'C') {
				if (tokens.length === 0) throw "Missing tempo after C in Q: field";
				token = tokens.shift();
				if (token.type === 'punct' && token.token === '=') {
					if (tokens.length === 0) throw "Missing tempo after = in Q: field";
					token = tokens.shift();
					if (token.type !== 'number') throw "Expected number after = in Q: field";
					tempo.duration = [1];
					tempo.bpm = parseInt(token.token, 10);
				} else if (token.type === 'number') {
					tempo.duration = [parseInt(token.token, 10)];
					if (tokens.length === 0) throw "Missing = after duration in Q: field";
					token = tokens.shift();
					if (token.type !== 'punct' || token.token !== '=') throw "Expected = after duration in Q: field";
					if (tokens.length === 0) throw "Missing tempo after = in Q: field";
					token = tokens.shift();
					if (token.type !== 'number') throw "Expected number after = in Q: field";
					tempo.bpm = parseInt(token.token, 10);
				} else throw "Expected number or equal after C in Q: field";

			} else if (token.type === 'number') {
				let num = parseInt(token.token, 10);
				if (tokens.length === 0 || tokens[0].type === 'quote') {
					tempo.duration = [1];
					tempo.bpm = num;
				} else {
					delaySet = false;
					token = tokens.shift();
					if (token.type !== 'punct' && token.token !== '/') throw "Expected fraction in Q: field";
					token = tokens.shift();
					if (token.type !== 'number') throw "Expected fraction in Q: field";
					let den = parseInt(token.token, 10);
					tempo.duration = [num / den];
					while (tokens.length > 0 && tokens[0].token !== '=' && tokens[0].type !== 'quote') {
						token = tokens.shift();
						if (token.type !== 'number') throw "Expected fraction in Q: field";
						num = parseInt(token.token, 10);
						token = tokens.shift();
						if (token.type !== 'punct' && token.token !== '/') throw "Expected fraction in Q: field";
						token = tokens.shift();
						if (token.type !== 'number') throw "Expected fraction in Q: field";
						den = parseInt(token.token, 10);
						tempo.duration.push(num / den);
					}
					token = tokens.shift();
					if (token.type !== 'punct' && token.token !== '=') throw "Expected = in Q: field";
					token = tokens.shift();
					if (token.type !== 'number') throw "Expected tempo in Q: field";
					tempo.bpm = parseInt(token.token, 10);
				}
			} else throw "Unknown value in Q: field";

			if (tokens.length !== 0) {
				token = tokens.shift();
				if (token.type === 'quote') {
					tempo.postString = token.token;
					token = tokens.shift();
				}
				if (tokens.length !== 0) throw "Unexpected string at end of Q: field";
			}
			if (this.multilineVars.printTempo === false)
				tempo.suppress = true;
			return { type: delaySet ? 'delaySet' : 'immediate', tempo: tempo };
		} catch (msg) {
			this.warn(msg, line, start);
			return { type: 'none' };
		}
	}

	public letter_to_inline_header(line: string, i: number, startLine: boolean): any[] {
		let needsNewLine = false;
		const ws = this.tokenizer.eatWhiteSpace(line, i);
		i += ws;
		if (line.length >= i + 5 && line[i] === '[' && line[i + 2] === ':') {
			let e = line.indexOf(']', i);
			const startChar = this.multilineVars.iChar + i;
			const endChar = this.multilineVars.iChar + e + 1;
			switch (line.substring(i, i + 3)) {
				case "[I:":
					const err = parseDirective.addDirective(line.substring(i + 3, e));
					if (err) this.warn(err, line, i);
					return [e - i + 1 + ws];
				case "[M:":
					const meter = this.setMeter(line.substring(i + 3, e));
					if (this.tuneBuilder.hasBeginMusic() && meter)
						this.tuneBuilder.appendStartingElement('meter', startChar, endChar, meter);
					else
						this.multilineVars.meter = meter;
					return [e - i + 1 + ws];
				case "[K:":
					const result = parseKeyVoice.parseKey(line.substring(i + 3, e), true);
					if (result.foundClef && this.tuneBuilder.hasBeginMusic())
						this.tuneBuilder.appendStartingElement('clef', startChar, endChar, this.multilineVars.clef);
					if (result.foundKey && this.tuneBuilder.hasBeginMusic())
						this.tuneBuilder.appendStartingElement('key', startChar, endChar, parseKeyVoice.fixKey(this.multilineVars.clef, this.multilineVars.key));
					return [e - i + 1 + ws];
				case "[P:":
					const part = parseDirective.parseFontChangeLine(line.substring(i + 3, e));
					if (startLine || this.tune.lines.length <= this.tune.lineNum)
						this.multilineVars.partForNextLine = { title: part, startChar: startChar, endChar: endChar };
					else
						this.tuneBuilder.appendElement('part', startChar, endChar, { title: part });
					return [e - i + 1 + ws];
				case "[L:":
					this.setDefaultLength(line, i + 3, e);
					return [e - i + 1 + ws];
				case "[Q:":
					if (e > 0) {
						const tempo = this.setTempo(line, i + 3, e, this.multilineVars.iChar);
						if (tempo.type === 'delaySet') {
							if (this.tuneBuilder.hasBeginMusic())
								this.tuneBuilder.appendElement('tempo', startChar, endChar, this.calcTempo(tempo.tempo));
							else
								this.multilineVars.tempoForNextLine = ['tempo', startChar, endChar, this.calcTempo(tempo.tempo)];
						} else if (tempo.type === 'immediate') {
							if (!startLine && this.tuneBuilder.hasBeginMusic())
								this.tuneBuilder.appendElement('tempo', startChar, endChar, tempo.tempo);
							else
								this.multilineVars.tempoForNextLine = ['tempo', startChar, endChar, tempo.tempo];
						}
						return [e - i + 1 + ws, line[i + 1], line.substring(i + 3, e)];
					}
					break;
				case "[V:":
					if (e > 0) {
						needsNewLine = parseKeyVoice.parseVoice(line, i + 3, e);
						return [e - i + 1 + ws, line[i + 1], line.substring(i + 3, e), needsNewLine];
					}
					break;
				case "[r:":
					return [e - i + 1 + ws];
				default:
			}
		}
		return [0];
	}

	public letter_to_body_header(line: string, i: number): any[] {
		let needsNewLine = false;
		if (line.length >= i + 3) {
			switch (line.substring(i, i + 2)) {
				case "I:":
					const err = parseDirective.addDirective(line.substring(i + 2));
					if (err) this.warn(err, line, i);
					return [line.length];
				case "M:":
					const meter = this.setMeter(line.substring(i + 2));
					if (this.tuneBuilder.hasBeginMusic() && meter)
						this.tuneBuilder.appendStartingElement('meter', this.multilineVars.iChar + i, this.multilineVars.iChar + line.length, meter);
					return [line.length];
				case "K:":
					const result = parseKeyVoice.parseKey(line.substring(i + 2), this.tuneBuilder.hasBeginMusic());
					if (result.foundClef && this.tuneBuilder.hasBeginMusic() && this.multilineVars.keywarn !== false)
						this.tuneBuilder.appendStartingElement('clef', this.multilineVars.iChar + i, this.multilineVars.iChar + line.length, this.multilineVars.clef);
					if (result.foundKey && this.tuneBuilder.hasBeginMusic() && this.multilineVars.keywarn !== false)
						this.tuneBuilder.appendStartingElement('key', this.multilineVars.iChar + i, this.multilineVars.iChar + line.length, parseKeyVoice.fixKey(this.multilineVars.clef, this.multilineVars.key));
					return [line.length];
				case "P:":
					if (this.tuneBuilder.hasBeginMusic())
						this.tuneBuilder.appendElement('part', this.multilineVars.iChar + i, this.multilineVars.iChar + line.length, { title: line.substring(i + 2) });
					return [line.length];
				case "L:":
					this.setDefaultLength(line, i + 2, line.length);
					return [line.length];
				case "Q:":
					let e = line.indexOf('\x12', i + 2);
					if (e === -1) e = line.length;
					const tempo = this.setTempo(line, i + 2, e, this.multilineVars.iChar);
					if (tempo.type === 'delaySet') this.tuneBuilder.appendElement('tempo', this.multilineVars.iChar + i, this.multilineVars.iChar + line.length, this.calcTempo(tempo.tempo));
					else if (tempo.type === 'immediate') this.tuneBuilder.appendElement('tempo', this.multilineVars.iChar + i, this.multilineVars.iChar + line.length, tempo.tempo);
					return [e, line[i], parseCommon.strip(line.substring(i + 2))];
				case "V:":
					needsNewLine = parseKeyVoice.parseVoice(line, i + 2, line.length);
					return [line.length, line[i], parseCommon.strip(line.substring(i + 2)), needsNewLine];
				default:
			}
		}
		return [0];
	}

	private metaTextHeaders: { [key: string]: string } = {
		A: 'author', B: 'book', C: 'composer', D: 'discography', F: 'url', G: 'group', I: 'instruction',
		N: 'notes', O: 'origin', R: 'rhythm', S: 'source', W: 'unalignedWords', Z: 'transcription'
	};

	public parseHeader(line: string): any {
		const field = this.metaTextHeaders[line[0]];
		const origSize = line.length - 2;
		let restOfLine = this.tokenizer.translateString(this.tokenizer.stripComment(line.substring(2)));
		if (field === 'unalignedWords' || field === 'notes') {
			this.tuneBuilder.addMetaTextArray(field, parseDirective.parseFontChangeLine(restOfLine), { startChar: this.multilineVars.iChar, endChar: this.multilineVars.iChar + line.length });
		} else if (field !== undefined) {
			this.tuneBuilder.addMetaText(field, parseDirective.parseFontChangeLine(restOfLine), { startChar: this.multilineVars.iChar, endChar: this.multilineVars.iChar + line.length });
		} else {
			const startChar = this.multilineVars.iChar;
			const endChar = startChar + line.length;
			switch (line[0]) {
				case 'H':
					this.tuneBuilder.addMetaTextArray("history", parseDirective.parseFontChangeLine(restOfLine), { startChar: this.multilineVars.iChar, endChar: this.multilineVars.iChar + line.length });
					let nextLine = this.tokenizer.peekLine();
					while (nextLine && nextLine[1] !== ':') {
						this.tokenizer.nextLine();
						this.tuneBuilder.addMetaTextArray("history", parseDirective.parseFontChangeLine(this.tokenizer.translateString(this.tokenizer.stripComment(nextLine))), { startChar: this.multilineVars.iChar, endChar: this.multilineVars.iChar + nextLine.length });
						nextLine = this.tokenizer.peekLine();
					}
					break;
				case 'K':
					this.resolveTempo();
					const result = parseKeyVoice.parseKey(line.substring(2), false);
					if (!this.multilineVars.is_in_header && this.tuneBuilder.hasBeginMusic() && this.multilineVars.keywarn !== false) {
						if (result.foundClef)
							this.tuneBuilder.appendStartingElement('clef', startChar, endChar, this.multilineVars.clef);
						if (result.foundKey)
							this.tuneBuilder.appendStartingElement('key', startChar, endChar, parseKeyVoice.fixKey(this.multilineVars.clef, this.multilineVars.key));
					}
					this.multilineVars.is_in_header = false;
					break;
				case 'L':
					this.setDefaultLength(line, 2, line.length);
					break;
				case 'M':
					this.multilineVars.origMeter = this.multilineVars.meter = this.setMeter(line.substring(2));
					break;
				case 'P':
					if (this.multilineVars.is_in_header)
						this.tuneBuilder.addMetaText("partOrder", parseDirective.parseFontChangeLine(restOfLine), { startChar: this.multilineVars.iChar, endChar: this.multilineVars.iChar + line.length });
					else
						this.multilineVars.partForNextLine = { title: restOfLine, startChar: startChar, endChar: endChar };
					break;
				case 'Q':
					const tempo = this.setTempo(line, 2, line.length, this.multilineVars.iChar);
					if (tempo.type === 'delaySet') this.multilineVars.tempo = tempo.tempo;
					else if (tempo.type === 'immediate') {
						if (!this.tune.metaText.tempo)
							this.tune.metaText.tempo = tempo.tempo;
						else
							this.multilineVars.tempoForNextLine = ['tempo', startChar, endChar, tempo.tempo];
					}
					break;
				case 'T':
					if (this.multilineVars.titlecaps)
						restOfLine = restOfLine.toUpperCase();
					this.setTitle(parseDirective.parseFontChangeLine(this.tokenizer.theReverser(restOfLine)), origSize);
					break;
				case 'U':
					this.addUserDefinition(line, 2, line.length);
					break;
				case 'V':
					parseKeyVoice.parseVoice(line, 2, line.length);
					if (!this.multilineVars.is_in_header)
						return { newline: true };
					break;
				case 's':
					return { symbols: true };
				case 'w':
					return { words: true };
				case 'X':
					break;
				case 'E':
				case 'm':
					this.warn("Ignored header", line, 0);
					break;
				default:
					return { regular: true };
			}
		}
		return {};
	}
}
