import getNote, { NoteResponse } from './load-note';
import createNoteMap, { NoteMapEvent } from './create-note-map';
import registerAudioContext from './register-audio-context';
import activeAudioContext from './active-audio-context';
import supportsAudio from './supports-audio';
import pitchToNoteName from './pitch-to-note-name';
import instrumentIndexToName from './instrument-index-to-name';
import downloadBuffer from './download-buffer';
import placeNote, { SoundInfo } from './place-note';
import soundsCache from './sounds-cache';

const notSupportedMessage = "MIDI is not supported in this browser.";

const originalSoundFontUrl = "https://paulrosen.github.io/midi-js-soundfonts/abcjs/";
const defaultSoundFontUrl = "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/";
const alternateSoundFontUrl = "https://paulrosen.github.io/midi-js-soundfonts/MusyngKite/";

export default class CreateSynth {
	public audioBufferPossible: boolean | undefined;
	public directSource: AudioBufferSourceNode[] = [];
	public startTimeSec: number | undefined;
	public pausedTimeSec: number | undefined;
	public audioBuffers: AudioBuffer[] = [];
	public duration: number | undefined;
	public isRunning: boolean = false;
	public options: any = {};
	public pickupLength: number = 0;

	private debugCallback?: (msg: string) => void;
	private soundFontUrl: string = defaultSoundFontUrl;
	private soundFontVolumeMultiplier: number = 1.0;
	private programOffsets: Record<string, number> = {};
	private fadeLength: number = 200;
	private noteEnd: number = 0;
	private pan: any;
	private meterSize: number = 1;
	private flattened: any;
	private millisecondsPerMeasure: number = 1000;
	private beatsPerMeasure: number = 4;
	private sequenceCallback: any;
	private callbackContext: any;
	private onEnded: any;
	private meterFraction: any = { den: 1 };

	public init(options: any): Promise<any> {
		if (!options) options = {};
		if (options.options) this.options = options.options;
		
		registerAudioContext(options.audioContext);
		const startTimeInit = activeAudioContext()!.currentTime;
		this.debugCallback = options.debugCallback;
		if (this.debugCallback) this.debugCallback("init called");
		
		this.audioBufferPossible = this._deviceCapable();
		if (!this.audioBufferPossible)
			return Promise.reject({ status: "NotSupported", message: notSupportedMessage });
		
		const params = options.options ? options.options : {};
		this.soundFontUrl = params.soundFontUrl ? params.soundFontUrl : defaultSoundFontUrl;
		if (this.soundFontUrl[this.soundFontUrl.length - 1] !== '/') this.soundFontUrl += '/';
		
		if (params.soundFontVolumeMultiplier || params.soundFontVolumeMultiplier === 0)
			this.soundFontVolumeMultiplier = params.soundFontVolumeMultiplier;
		else if (this.soundFontUrl === defaultSoundFontUrl || this.soundFontUrl === alternateSoundFontUrl)
			this.soundFontVolumeMultiplier = 3.0;
		else if (this.soundFontUrl === originalSoundFontUrl)
			this.soundFontVolumeMultiplier = 0.4;
		else
			this.soundFontVolumeMultiplier = 1.0;

		if (params.programOffsets)
			this.programOffsets = params.programOffsets;
		else if (this.soundFontUrl === originalSoundFontUrl)
			this.programOffsets = {
				"bright_acoustic_piano": 20, "honkytonk_piano": 20, "electric_piano_1": 30, "electric_piano_2": 30,
				"harpsichord": 40, "clavinet": 20, "celesta": 20, "glockenspiel": 40, "vibraphone": 30, "marimba": 35,
				"xylophone": 30, "tubular_bells": 35, "dulcimer": 30, "drawbar_organ": 20, "percussive_organ": 25,
				"rock_organ": 20, "church_organ": 40, "reed_organ": 40, "accordion": 40, "harmonica": 40,
				"acoustic_guitar_nylon": 20, "acoustic_guitar_steel": 30, "electric_guitar_jazz": 25,
				"electric_guitar_clean": 15, "electric_guitar_muted": 35, "overdriven_guitar": 25,
				"distortion_guitar": 20, "guitar_harmonics": 30, "electric_bass_finger": 15, "electric_bass_pick": 30,
				"fretless_bass": 40, "violin": 105, "viola": 50, "cello": 40, "contrabass": 60, "trumpet": 10,
				"trombone": 90, "alto_sax": 20, "tenor_sax": 20, "clarinet": 20, "flute": 50, "banjo": 50, "woodblock": 20,
			};
		else
			this.programOffsets = {};

		const fadeLen = params.fadeLength !== undefined ? parseInt(params.fadeLength, 10) : NaN;
		this.fadeLength = isNaN(fadeLen) ? 200 : fadeLen;
		const nEnd = params.noteEnd !== undefined ? parseInt(params.noteEnd, 10) : NaN;
		this.noteEnd = isNaN(nEnd) ? 0 : nEnd;

		this.pan = params.pan;
		this.meterSize = 1;

		if (options.visualObj) {
			this.flattened = options.visualObj.setUpAudio(params);
			const meter = options.visualObj.getMeterFraction();
			if (meter.den) this.meterSize = meter.num / meter.den;
			this.pickupLength = options.visualObj.getPickupLength();
		} else if (options.sequence) {
			this.flattened = options.sequence;
		} else {
			return Promise.reject(new Error("Must pass in either a visualObj or a sequence"));
		}

		this.millisecondsPerMeasure = options.millisecondsPerMeasure ? options.millisecondsPerMeasure : (options.visualObj ? options.visualObj.millisecondsPerMeasure(this.flattened.tempo) : 1000);
		this.beatsPerMeasure = options.visualObj ? options.visualObj.getBeatsPerMeasure() : 4;
		this.sequenceCallback = params.sequenceCallback;
		this.callbackContext = params.callbackContext;
		this.onEnded = params.onEnded;
		this.meterFraction = options.visualObj ? options.visualObj.getMeterFraction() : { den: 1 };

		const allNotes: Record<string, Record<string, boolean>> = {};
		const cached: string[] = [];
		const errorNotes: string[] = [];
		let currentInstrument = instrumentIndexToName[0];

		this.flattened.tracks.forEach((track: any[]) => {
			track.forEach((event: any) => {
				if (event.cmd === "program" && instrumentIndexToName[event.instrument])
					currentInstrument = instrumentIndexToName[event.instrument];
				if (event.pitch !== undefined) {
					const pitchNumber = event.pitch;
					const noteName = pitchToNoteName[pitchNumber];
					const inst = event.instrument !== undefined ? instrumentIndexToName[event.instrument] : currentInstrument;
					if (noteName) {
						if (!allNotes[inst]) allNotes[inst] = {};
						if (!soundsCache[inst] || !soundsCache[inst][noteName])
							allNotes[inst][noteName] = true;
						else {
							const label2 = inst + ":" + noteName;
							if (cached.indexOf(label2) < 0) cached.push(label2);
						}
					} else {
						const label = inst + ":" + noteName;
						console.log("Can't find note: ", pitchNumber, label);
						if (errorNotes.indexOf(label) < 0) errorNotes.push(label);
					}
				}
			});
		});

		if (this.debugCallback)
			this.debugCallback("note gathering time = " + Math.floor((activeAudioContext()!.currentTime - startTimeInit) * 1000) + "ms");
		
		let startTimeLoading = activeAudioContext()!.currentTime;
		const notes: { instrument: string, note: string }[] = [];
		Object.keys(allNotes).forEach(instrument => {
			Object.keys(allNotes[instrument]).forEach(note => {
				notes.push({ instrument, note });
			});
		});

		if (this.debugCallback) this.debugCallback("notes " + JSON.stringify(notes));

		const batches: { instrument: string, note: string }[][] = [];
		const CHUNK = 256;
		for (let i = 0; i < notes.length; i += CHUNK) {
			batches.push(notes.slice(i, i + CHUNK));
		}

		return new Promise((resolve, reject) => {
			const results = { cached, error: errorNotes, loaded: [] as string[] };
			let index = 0;
			const next = () => {
				if (this.debugCallback) this.debugCallback("loadBatch idx=" + index + " len=" + batches.length);
				if (index < batches.length) {
					this._loadBatch(batches[index], this.soundFontUrl, startTimeLoading).then((data: any) => {
						if (this.debugCallback) this.debugCallback("loadBatch then");
						startTimeLoading = activeAudioContext()!.currentTime;
						if (data) {
							if (data.error) results.error = results.error.concat(data.error);
							if (data.loaded) results.loaded = results.loaded.concat(data.loaded);
						}
						index++;
						next();
					}, reject);
				} else {
					if (this.debugCallback) this.debugCallback("resolve init");
					resolve(results);
				}
			};
			next();
		});
	}

	private _loadBatch(batch: { instrument: string, note: string }[], soundFontUrl: string, startTime: number, delay?: number): Promise<any> {
		const promises: Promise<NoteResponse>[] = [];
		batch.forEach(item => {
			if (this.debugCallback) this.debugCallback("getNote " + item.instrument + ':' + item.note);
			promises.push(getNote(soundFontUrl, item.instrument, item.note, activeAudioContext()!));
		});
		return Promise.all(promises).then((response: NoteResponse[]) => {
			if (this.debugCallback)
				this.debugCallback("mp3 load time = " + Math.floor((activeAudioContext()!.currentTime - startTime) * 1000) + "ms");
			
			const loaded: string[] = [];
			const cached: string[] = [];
			const pending: string[] = [];
			const error: string[] = [];
			
			for (let i = 0; i < response.length; i++) {
				const oneResponse = response[i];
				const which = oneResponse.instrument + ":" + oneResponse.name;
				if (oneResponse.status === "loaded") loaded.push(which);
				else if (oneResponse.status === "pending") pending.push(which);
				else if (oneResponse.status === "cached") cached.push(which);
				else error.push(which + ' ' + oneResponse.message);
			}

			if (pending.length > 0) {
				if (this.debugCallback) this.debugCallback("pending " + JSON.stringify(pending));
				if (!delay) delay = 50; else delay = delay * 2;
				if (delay < 90000) {
					return new Promise((resolve, reject) => {
						setTimeout(() => {
							const newBatch = pending.map(p => {
								const which = p.split(":");
								return { instrument: which[0], note: which[1] };
							});
							if (this.debugCallback) this.debugCallback("retry " + JSON.stringify(newBatch));
							this._loadBatch(newBatch, soundFontUrl, startTime, delay).then(resolve).catch(reject);
						}, delay);
					});
				} else {
					const list = batch.map(b => b.instrument + '/' + b.note);
					if (this.debugCallback) this.debugCallback("loadBatch timeout");
					return Promise.reject(new Error("timeout attempting to load: " + list.join(", ")));
				}
			} else {
				if (this.debugCallback) this.debugCallback("loadBatch resolve");
				return Promise.resolve({ loaded, cached, error });
			}
		}).catch(error => {
			if (this.debugCallback) this.debugCallback("loadBatch catch " + error.message);
		});
	}

	public prime(): Promise<any> {
		const fadeTimeSec = this.fadeLength / 1000;
		this.isRunning = false;
		if (!this.audioBufferPossible) return Promise.reject(new Error(notSupportedMessage));
		if (this.debugCallback) this.debugCallback("prime called");

		return new Promise((resolve, reject) => {
			try {
				const startTime = activeAudioContext()!.currentTime;
				const tempoMultiplier = this.millisecondsPerMeasure / 1000 / this.meterSize;
				this.duration = this.flattened.totalDuration * tempoMultiplier;
				if (this.duration! <= 0) {
					this.audioBuffers = [];
					return resolve({ status: "empty", seconds: 0 });
				}
				this.duration! += fadeTimeSec;
				const totalSamples = Math.floor(activeAudioContext()!.sampleRate * this.duration!);

				this.stop();
				const noteMapTracks = createNoteMap(this.flattened);
				if (this.options.swing)
					this._addSwing(noteMapTracks, this.options.swing, this.meterFraction, this.pickupLength);

				if (this.sequenceCallback)
					this.sequenceCallback(noteMapTracks, this.callbackContext);

				const panDistances = this._setPan(noteMapTracks.length, this.pan);
				const uniqueSounds: Record<string, number[]> = {};

				noteMapTracks.forEach((noteMap, trackNumber) => {
					const panDistance = panDistances && panDistances.length > trackNumber ? panDistances[trackNumber] : 0;
					noteMap.forEach(note => {
						const key = note.instrument + ':' + note.pitch + ':' + note.volume + ':' + Math.round((note.end - note.start) * 1000) / 1000 + ':' + panDistance + ':' + tempoMultiplier + ':' + (note.cents ? note.cents : 0);
						if (!uniqueSounds[key]) uniqueSounds[key] = [];
						uniqueSounds[key].push(note.start);
					});
				});

				const allPromises: Promise<void>[] = [];
				const audioBuffer = activeAudioContext()!.createBuffer(2, totalSamples, activeAudioContext()!.sampleRate);
				
				Object.keys(uniqueSounds).forEach(k => {
					const partsArr = k.split(":");
					const cents = partsArr[6] !== undefined ? parseFloat(partsArr[6]) : 0;
					const parts: SoundInfo = {
						instrument: partsArr[0], pitch: parseInt(partsArr[1], 10), volume: parseInt(partsArr[2], 10),
						len: parseFloat(partsArr[3]), pan: parseFloat(partsArr[4]), tempoMultiplier: parseFloat(partsArr[5]), cents
					};
					allPromises.push(placeNote(audioBuffer, activeAudioContext()!.sampleRate, parts, uniqueSounds[k], this.soundFontVolumeMultiplier, this.programOffsets[parts.instrument], fadeTimeSec, this.noteEnd / 1000, this.debugCallback));
				});

				this.audioBuffers = [audioBuffer];
				
				const resolveData = () => ({ status: activeAudioContext()!.state, duration: this.audioBuffers[0].duration });

				Promise.all(allPromises).then(() => {
					const ac = activeAudioContext()!;
					if (ac.state === "suspended") {
						ac.resume().then(() => resolve(resolveData()));
					} else if (ac.state === "interrupted") {
						ac.suspend().then(() => ac.resume().then(() => resolve(resolveData())));
					} else {
						resolve(resolveData());
					}
				}).catch(reject);
			} catch (error) {
				reject(error);
			}
		});
	}

	private _setPan(numTracks: number, panParam: any): number[] | null {
		if (panParam === null || panParam === undefined) return null;
		const panDistances: number[] = [];
		if (Array.isArray(panParam)) {
			for (let pp = 0; pp < numTracks; pp++) {
				if (pp < panParam.length) {
					let x = parseFloat(panParam[pp]);
					if (x < -1) x = -1; else if (x > 1) x = 1;
					panDistances.push(x);
				} else panDistances.push(0);
			}
			return panDistances;
		} else {
			const panNumber = parseFloat(panParam);
			if (panNumber * (numTracks - 1) > 2) return null;
			const even = numTracks % 2 === 0;
			let currLow = even ? 0 - panNumber / 2 : 0;
			let currHigh = currLow + panNumber;
			for (let p = 0; p < numTracks; p++) {
				const isEvenTrack = p % 2 === 0;
				if (isEvenTrack) {
					panDistances.push(currLow);
					currLow -= panNumber;
				} else {
					panDistances.push(currHigh);
					currHigh += panNumber;
				}
			}
			return panDistances;
		}
	}

	public start(): void {
		if (!this.audioBufferPossible) throw new Error(notSupportedMessage);
		const resumePosition = this.pausedTimeSec ? this.pausedTimeSec : 0;
		this._kickOffSound(resumePosition);
		this.startTimeSec = activeAudioContext()!.currentTime - resumePosition;
		this.pausedTimeSec = undefined;
	}

	public pause(): number {
		if (!this.audioBufferPossible) throw new Error(notSupportedMessage);
		this.pausedTimeSec = this.stop();
		return this.pausedTimeSec;
	}

	public resume(): void { this.start(); }

	public seek(position: number, units: string): void {
		let offset: number;
		switch (units) {
			case "seconds": offset = position; break;
			case "beats": offset = position * this.millisecondsPerMeasure / this.beatsPerMeasure / 1000; break;
			default: offset = (this.duration! - this.fadeLength / 1000) * position; break;
		}
		if (!this.audioBufferPossible) throw new Error(notSupportedMessage);
		if (this.isRunning) { this.stop(); this._kickOffSound(offset); } else { this.pausedTimeSec = offset; }
		this.pausedTimeSec = offset;
	}

	public stop(): number {
		this.isRunning = false;
		const paused = this.pausedTimeSec;
		this.pausedTimeSec = undefined;
		this.directSource.forEach(source => { try { source.stop(); } catch (e) { console.log("direct source didn't stop:", e); } });
		this.directSource = [];
		const elapsed = activeAudioContext()!.currentTime - (this.startTimeSec || activeAudioContext()!.currentTime);
		return paused !== undefined ? paused : elapsed;
	}

	public finished(): void {
		this.startTimeSec = undefined;
		this.pausedTimeSec = undefined;
		this.isRunning = false;
	}

	public download(): string { return downloadBuffer(this); }
	public getAudioBuffer(): AudioBuffer { return this.audioBuffers[0]; }
	public getIsRunning(): boolean { return this.isRunning; }

	private _deviceCapable(): boolean {
		if (!supportsAudio()) {
			console.warn(notSupportedMessage);
			return false;
		}
		return true;
	}

	private _kickOffSound(seconds: number): void {
		this.isRunning = true;
		this.directSource = [];
		const ac = activeAudioContext()!;
		this.audioBuffers.forEach((buffer, idx) => {
			const source = ac.createBufferSource();
			source.buffer = buffer;
			source.connect(ac.destination);
			this.directSource[idx] = source;
		});
		this.directSource.forEach(source => source.start(0, seconds));
		if (this.onEnded && this.directSource.length > 0) {
			this.directSource[0].onended = () => { if (this.onEnded) this.onEnded(this.callbackContext); };
		}
	}

	private _addSwing(noteMapTracks: NoteMapEvent[][], swing: any, meterFraction: any, pickupLength: number): void {
		if (meterFraction.den != 4 && meterFraction.den != 8) return;
		let swingVal = parseFloat(swing);
		if (isNaN(swingVal) || swingVal <= 50) return;
		if (swingVal > 75) swingVal = 75;
		swingVal = swingVal / 50 - 1;
		const volumeIncrease = 0.0;
		let beatLength = 0.25;
		if (meterFraction.den === 8) beatLength = beatLength / 2;
		const halfbeatLength = beatLength / 2;
		const swingDuration = halfbeatLength * swingVal;

		for (let t = 0; t < noteMapTracks.length; t++) {
			const track = noteMapTracks[t];
			for (let i = 0; i < track.length; i++) {
				const event = track[i];
				if ((event.start - pickupLength) % halfbeatLength == 0 && (event.start - pickupLength) % beatLength != 0
					&& (i == 0 || track[i - 1].start <= track[i].start - halfbeatLength)
					&& (i == track.length - 1 || track[i + 1].start >= track[i].start + halfbeatLength)) {
					const oldStart = event.start;
					event.start += swingDuration;
					event.volume *= 1 + volumeIncrease;
					if (i > 0 && track[i - 1].end == oldStart) {
						track[i - 1].end = event.start;
						track[i - 1].volume *= 1 - volumeIncrease;
					}
				}
			}
		}
	}
}
