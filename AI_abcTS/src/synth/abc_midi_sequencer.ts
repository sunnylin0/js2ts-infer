import parseCommon from "../parse/abc_common";
import Repeats from "./repeats";

export class MidiSequencer {
	private measureLength = 1;
	private PERCUSSION_PROGRAM = 128;

	public sequence(abctune: any, options: any): any[] {
		options = options || {};
		let qpm: number;
		let program = options.program || 0;
		let transpose = options.midiTranspose || 0;
		if (abctune.visualTranspose)
			transpose -= abctune.visualTranspose;
		let channel = options.channel || 0;
		let channelExplicitlySet = false;
		let drumPattern: any = options.drum || "";
		let drumBars = options.drumBars || 1;
		let drumIntro = options.drumIntro || 0;
		let drumOn = drumPattern !== "";
		let drumOffAfterIntro = !!options.drumOff
		let style: any[] = [];
		let rhythmHeadThisBar = false;
		let crescendoSize = 50;

		program = parseInt(program, 10);
		transpose = parseInt(transpose, 10);
		channel = parseInt(channel, 10);
		if (channel === 10)
			program = this.PERCUSSION_PROGRAM;
		drumPattern = typeof drumPattern === 'string' ? drumPattern.split(" ") : drumPattern;
		drumBars = parseInt(drumBars, 10);
		drumIntro = parseInt(drumIntro, 10);

		const bagpipes = abctune.formatting.bagpipes;
		if (bagpipes)
			program = 71;

		const startingMidi = [];
		if (abctune.formatting.midi) {
			const globals = abctune.formatting.midi;
			if (globals.program && globals.program.length > 0) {
				program = globals.program[0];
				if (globals.program.length > 1) {
					program = globals.program[1];
					channel = globals.program[0];
				}
				channelExplicitlySet = true;
			}
			if (globals.transpose)
				transpose = globals.transpose[0];
			if (globals.channel) {
				channel = globals.channel[0];
				channelExplicitlySet = true;
			}
			if (globals.drum)
				drumPattern = globals.drum;
			if (globals.drumbars)
				drumBars = globals.drumbars[0];
			if (globals.drumon)
				drumOn = true;
			if (channel === 10)
				program = this.PERCUSSION_PROGRAM;
			if (globals.beat)
				startingMidi.push({ el_type: 'beat', beats: globals.beat })
			if (globals.nobeataccents)
				startingMidi.push({ el_type: 'beataccents', value: false });

		}

		if (options.qpm)
			qpm = parseInt(options.qpm, 10);
		else if (abctune.metaText.tempo)
			qpm = this.interpretTempo(abctune.metaText.tempo, abctune.getBeatLength());
		else if (options.defaultQpm)
			qpm = options.defaultQpm;
		else
			qpm = 180;

		const startVoice = [];
		if (bagpipes)
			startVoice.push({ el_type: 'bagpipes' });
		startVoice.push({ el_type: 'instrument', program: program });
		if (channel)
			startVoice.push({ el_type: 'channel', channel: channel });
		if (transpose)
			startVoice.push({ el_type: 'transpose', transpose: transpose });
		startVoice.push({ el_type: 'tempo', qpm: qpm });
		for (let ss = 0; ss < startingMidi.length; ss++)
			startVoice.push(startingMidi[ss]);

		const voices: any[] = [];
		const clefTransposeActive: boolean[] = []
		const inCrescendo: any[] = [];
		const inDiminuendo: any[] = [];
		const durationCounter = [0];
		const tempoChanges: Record<string, any> = {};
		tempoChanges["0"] = { el_type: 'tempo', qpm: qpm, timing: 0 };
		let currentVolume: number[];
		const repeats: Repeats[] = []
		let startingDrumSet = false;
		const lines = abctune.lines;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.staff) {
				const staves = line.staff;
				let voiceNumber = 0;
				for (let j = 0; j < staves.length; j++) {
					const staff = staves[j];
					if (staff.clef && staff.clef.type === "TAB")
						continue;

					for (let k = 0; k < staff.voices.length; k++) {
						const voice = staff.voices[k];
						if (!voices[voiceNumber]) {
							voices[voiceNumber] = [].concat(JSON.parse(JSON.stringify(startVoice)));
							const voiceName = this.getTrackTitle(line.staff, voiceNumber);
							if (voiceName)
								voices[voiceNumber].unshift({ el_type: "name", trackName: voiceName });
							repeats[voiceNumber] = new Repeats(voices[voiceNumber])
						}
						if (transpose && staff.clef.type === "perc")
							voices[voiceNumber].push({ el_type: 'transpose', transpose: 0 });

						if (staff.clef && staff.clef.type === 'perc' && !channelExplicitlySet) {
							for (let cl = 0; cl < voices[voiceNumber].length; cl++) {
								if (voices[voiceNumber][cl].el_type === 'instrument')
									voices[voiceNumber][cl].program = this.PERCUSSION_PROGRAM;
							}
						} else if (staff.key) {
							this.addKey(voices[voiceNumber], staff.key);
						}
						if (staff.meter) {
							this.addMeter(voices[voiceNumber], staff.meter);
						}
						if (!startingDrumSet && drumOn) {
							voices[voiceNumber].push({ el_type: 'drum', params: { pattern: drumPattern, bars: drumBars, on: drumOn, intro: drumIntro } });
							startingDrumSet = true;
						}
						if (staff.clef && staff.clef.type !== "perc" && staff.clef.transpose) {
							staff.clef.el_type = 'clef';
							voices[voiceNumber].push({ el_type: 'transpose', transpose: staff.clef.transpose });
							clefTransposeActive[voiceNumber] = false
						}
						if (staff.clef && staff.clef.type) {
							if (staff.clef.type.indexOf("-8") >= 0) {
								voices[voiceNumber].push({ el_type: 'transpose', transpose: -12 });
								clefTransposeActive[voiceNumber] = true
							}
							else if (staff.clef.type.indexOf("+8") >= 0) {
								voices[voiceNumber].push({ el_type: 'transpose', transpose: 12 });
								clefTransposeActive[voiceNumber] = true
							}
							else {
								if (clefTransposeActive[voiceNumber]) {
									voices[voiceNumber].push({ el_type: 'transpose', transpose: 0 });
									clefTransposeActive[voiceNumber] = false
								}
							}
						}

						if (abctune.formatting.midi && abctune.formatting.midi.drumoff) {
							voices[voiceNumber].push({ el_type: 'bar' });
							voices[voiceNumber].push({ el_type: 'drum', params: { pattern: "", on: false } });
						}
						let noteEventsInBar = 0;
						let tripletMultiplier = 0;
						let tripletDurationTotal = 0;
						let tripletDurationCount = 0;
						currentVolume = [105, 95, 85, 1];

						for (let v = 0; v < voice.length; v++) {
							const elem = voice[v];
							switch (elem.el_type) {
								case "note":
									if (inCrescendo[voiceNumber]) {
										currentVolume[0] += inCrescendo[voiceNumber];
										currentVolume[1] += inCrescendo[voiceNumber];
										currentVolume[2] += inCrescendo[voiceNumber];
										voices[voiceNumber].push({ el_type: 'beat', beats: currentVolume.slice(0) });
									}

									if (inDiminuendo[voiceNumber]) {
										currentVolume[0] += inDiminuendo[voiceNumber];
										currentVolume[1] += inDiminuendo[voiceNumber];
										currentVolume[2] += inDiminuendo[voiceNumber];
										voices[voiceNumber].push({ el_type: 'beat', beats: currentVolume.slice(0) });
									}
									this.setDynamics(elem, crescendoSize, inCrescendo, inDiminuendo, voiceNumber, voice, v, currentVolume, voices);

									if (!elem.rest || elem.rest.type !== 'spacer') {
										const noteElem: any = { elem: elem, el_type: "note", timing: durationCounter[voiceNumber] };
										if (elem.style)
											noteElem.style = elem.style;
										else if (style[voiceNumber])
											noteElem.style = style[voiceNumber];
										noteElem.duration = (elem.duration === 0) ? 0.25 : elem.duration;
										if (elem.startTriplet) {
											tripletMultiplier = elem.tripletMultiplier;
											tripletDurationTotal = elem.startTriplet * tripletMultiplier * elem.duration;
											if (elem.startTriplet !== elem.tripletR) {
												if (v + elem.tripletR <= voice.length) {
													let durationTotal = 0;
													for (let w = v; w < v + elem.tripletR; w++) {
														durationTotal += voice[w].duration;
													}
													tripletDurationTotal = tripletMultiplier * durationTotal;
												}
											}
											noteElem.duration = noteElem.duration * tripletMultiplier;
											noteElem.duration = Math.round(noteElem.duration * 1000000) / 1000000;
											tripletDurationCount = noteElem.duration;
										} else if (tripletMultiplier) {
											if (elem.endTriplet) {
												tripletMultiplier = 0;
												noteElem.duration = Math.round((tripletDurationTotal - tripletDurationCount) * 1000000) / 1000000;
											} else {
												noteElem.duration = noteElem.duration * tripletMultiplier;
												noteElem.duration = Math.round(noteElem.duration * 1000000) / 1000000;
												tripletDurationCount += noteElem.duration;
											}
										}
										if (elem.rest) noteElem.rest = elem.rest;
										if (elem.decoration) noteElem.decoration = elem.decoration.slice(0);
										if (elem.pitches) noteElem.pitches = parseCommon.cloneArray(elem.pitches);
										if (elem.gracenotes) noteElem.gracenotes = parseCommon.cloneArray(elem.gracenotes);
										if (elem.chord) noteElem.chord = parseCommon.cloneArray(elem.chord);

										voices[voiceNumber].push(noteElem);
										if (elem.style === "rhythm") {
											rhythmHeadThisBar = true;
											this.chordVoiceOffThisBar(voices)
										}
										noteEventsInBar++;
										durationCounter[voiceNumber] += noteElem.duration;
									}
									break;
								case "key":
								case "keySignature":
									this.addKey(voices[voiceNumber], elem);
									break;
								case "meter":
									this.addMeter(voices[voiceNumber], elem);
									break;
								case "clef":
									if (elem.transpose)
										voices[voiceNumber].push({ el_type: 'transpose', transpose: elem.transpose });
									if (elem.type) {
										if (elem.type.indexOf("-8") >= 0)
											voices[voiceNumber].push({ el_type: 'transpose', transpose: -12 });
										else if (elem.type.indexOf("+8") >= 0)
											voices[voiceNumber].push({ el_type: 'transpose', transpose: 12 });
									}
									break;
								case "tempo":
									qpm = this.interpretTempo(elem, abctune.getBeatLength());
									voices[voiceNumber].push({ el_type: 'tempo', qpm: qpm, timing: durationCounter[voiceNumber] });
									tempoChanges['' + durationCounter[voiceNumber]] = { el_type: 'tempo', qpm: qpm, timing: durationCounter[voiceNumber] };
									break;
								case "bar":
									if (noteEventsInBar > 0)
										voices[voiceNumber].push({ el_type: 'bar' });
									this.setDynamics(elem, crescendoSize, inCrescendo, inDiminuendo, voiceNumber, voice, v, currentVolume, voices);
									noteEventsInBar = 0;
									repeats[voiceNumber].addBar(elem)
									rhythmHeadThisBar = false;
									break;
								case 'style':
									style[voiceNumber] = elem.head;
									break;
								case 'timeSignature':
									voices[voiceNumber].push(this.interpretMeter(elem));
									break;
								case 'midi':
									let drumChange = false;
									switch (elem.cmd) {
										case "drumon": drumOn = true; drumChange = true; break;
										case "drumoff": drumOn = false; drumChange = true; break;
										case "drum": drumPattern = elem.params; drumChange = true; break;
										case "drumbars": drumBars = elem.params[0]; drumChange = true; break;
										case "channel":
											if (elem.params[0] === 10)
												voices[voiceNumber].push({ el_type: 'instrument', program: this.PERCUSSION_PROGRAM });
											break;
										case "program":
											this.addIfDifferent(voices[voiceNumber], { el_type: 'instrument', program: elem.params[0] });
											channelExplicitlySet = true;
											break;
										case "transpose":
											voices[voiceNumber].push({ el_type: 'transpose', transpose: elem.params[0] });
											break;
										case "gchordoff":
											voices[voiceNumber].push({ el_type: 'gchordOn', tacet: true });
											break;
										case "gchordon":
											voices[voiceNumber].push({ el_type: 'gchordOn', tacet: false });
											break;
										case "beat":
											voices[voiceNumber].push({ el_type: 'beat', beats: elem.params });
											break;
										case "nobeataccents":
											voices[voiceNumber].push({ el_type: 'beataccents', value: false });
											break;
										case "beataccents":
											voices[voiceNumber].push({ el_type: 'beataccents', value: true });
											break;
										case "vol":
										case "volinc":
											voices[voiceNumber].push({ el_type: elem.cmd, volume: elem.params[0] });
											break;
										case "swing":
										case "gchord":
										case "bassvol":
										case "chordvol":
											voices[voiceNumber].push({ el_type: elem.cmd, param: elem.params[0] });
											break;
										case "bassprog":
										case "chordprog":
											voices[voiceNumber].push({
												el_type: elem.cmd,
												value: elem.params[0],
												octaveShift: elem.params[1]
											});
											break;
										case "gchordbars":
											voices[voiceNumber].push({
												el_type: elem.cmd,
												param: elem.params[0]
											});
											break;
										default:
											console.log("MIDI seq: midi cmd not handled: ", elem.cmd, elem);
									}
									if (drumChange) {
										voices[0].push({ el_type: 'drum', params: { pattern: drumPattern, bars: drumBars, intro: drumIntro, on: drumOn } });
										startingDrumSet = true;
									}
									break;
								default:
									console.log("MIDI: element type " + elem.el_type + " not handled.");
							}
						}
						voiceNumber++;
						if (!durationCounter[voiceNumber])
							durationCounter[voiceNumber] = 0;
					}
				}
			}
		}
		for (let r = 0; r < repeats.length; r++)
			voices[r] = repeats[r].resolveRepeats()

		this.insertTempoChanges(voices, tempoChanges);

		if (drumIntro) {
			const pickups = abctune.getPickupLength();
			for (let vv = 0; vv < voices.length; vv++) {
				let insertPoint = 0;
				while (voices[vv].length > insertPoint && voices[vv][insertPoint].el_type !== "note")
					insertPoint++;
				if (voices[vv].length > insertPoint) {
					for (let w = 0; w < drumIntro; w++) {
						if (pickups === 0 || w < drumIntro - 1) {
							voices[vv].splice(insertPoint, 0,
								{ el_type: "note", rest: { type: "rest" }, duration: this.measureLength },
								{ el_type: "bar" }
							);
							insertPoint += 2
						} else {
							voices[vv].splice(insertPoint++, 0, { el_type: "note", rest: { type: "rest" }, duration: this.measureLength - pickups });
						}
					}
					if (drumOffAfterIntro) {
						drumOn = false
						voices[vv].splice(insertPoint++, 0, { el_type: 'drum', params: { pattern: drumPattern, bars: drumBars, intro: drumIntro, on: drumOn } });
						drumOffAfterIntro = false
					}
				}
			}
		}
		if (voices.length > 0 && voices[0].length > 0) {
			voices[0][0].pickupLength = abctune.getPickupLength();
		}
		return voices;
	}

	private setDynamics(elem: any, crescendoSize: number, inCrescendo: any[], inDiminuendo: any[], voiceNumber: number, voice: any[], v: number, currentVolume: number[], voices: any[]) {
		const volumes: Record<string, number[]> = {
			'pppp': [15, 10, 5, 1],
			'ppp': [30, 20, 10, 1],
			'pp': [45, 35, 20, 1],
			'p': [60, 50, 35, 1],
			'mp': [75, 65, 50, 1],
			'mf': [90, 80, 65, 1],
			'f': [105, 95, 80, 1],
			'ff': [120, 110, 95, 1],
			'fff': [127, 125, 110, 1],
			'ffff': [127, 125, 110, 1]
		};

		let dynamicType;
		if (elem.decoration) {
			if (elem.decoration.indexOf('pppp') >= 0) dynamicType = 'pppp';
			else if (elem.decoration.indexOf('ppp') >= 0) dynamicType = 'ppp';
			else if (elem.decoration.indexOf('pp') >= 0) dynamicType = 'pp';
			else if (elem.decoration.indexOf('p') >= 0) dynamicType = 'p';
			else if (elem.decoration.indexOf('mp') >= 0) dynamicType = 'mp';
			else if (elem.decoration.indexOf('mf') >= 0) dynamicType = 'mf';
			else if (elem.decoration.indexOf('f') >= 0) dynamicType = 'f';
			else if (elem.decoration.indexOf('ff') >= 0) dynamicType = 'ff';
			else if (elem.decoration.indexOf('fff') >= 0) dynamicType = 'fff';
			else if (elem.decoration.indexOf('ffff') >= 0) dynamicType = 'ffff';

			if (dynamicType) {
				const activeVol = volumes[dynamicType].slice(0);
				for (let i = 0; i < currentVolume.length; i++) currentVolume[i] = activeVol[i];

				let volumesPerNotePitch = [currentVolume.slice(0)];
				if (Array.isArray(elem.decoration)) {
					volumesPerNotePitch = [];
					elem.decoration.forEach((d: string) => {
						if (d in volumes)
							volumesPerNotePitch.push(volumes[d].slice(0));
					});
				}
				voices[voiceNumber].push({ el_type: 'beat', beats: currentVolume.slice(0), volumesPerNotePitch: volumesPerNotePitch, });
				inCrescendo[voiceNumber] = false;
				inDiminuendo[voiceNumber] = false;
			}

			if (elem.decoration.indexOf("crescendo(") >= 0) {
				const n = this.numNotesToDecoration(voice, v, "crescendo)");
				let top = Math.min(127, currentVolume[0] + crescendoSize);
				const endDec = this.endingVolume(voice, v + n + 1, Object.keys(volumes));
				if (endDec)
					top = volumes[endDec][0];
				if (n > 0)
					inCrescendo[voiceNumber] = Math.floor((top - currentVolume[0]) / n);
				else
					inCrescendo[voiceNumber] = false;
				inDiminuendo[voiceNumber] = false;
			} else if (elem.decoration.indexOf("crescendo)") >= 0) {
				inCrescendo[voiceNumber] = false;
			} else if (elem.decoration.indexOf("diminuendo(") >= 0) {
				const n2 = this.numNotesToDecoration(voice, v, "diminuendo)");
				let bottom = Math.max(15, currentVolume[0] - crescendoSize);
				const endDec2 = this.endingVolume(voice, v + n2 + 1, Object.keys(volumes));
				if (endDec2)
					bottom = volumes[endDec2][0];
				inCrescendo[voiceNumber] = false;
				if (n2 > 0)
					inDiminuendo[voiceNumber] = Math.floor((bottom - currentVolume[0]) / n2);
				else
					inDiminuendo[voiceNumber] = false;
			} else if (elem.decoration.indexOf("diminuendo)") >= 0) {
				inDiminuendo[voiceNumber] = false;
			}
		}
	}

	private numNotesToDecoration(voice: any[], start: number, decoration: string) {
		let counter = 0;
		for (let i = start + 1; i < voice.length; i++) {
			if (voice[i].el_type === "note")
				counter++;
			if (voice[i].decoration && voice[i].decoration.indexOf(decoration) >= 0)
				return counter;
		}
		return counter;
	}

	private endingVolume(voice: any[], start: number, volumeDecorations: string[]) {
		const end = Math.min(voice.length, start + 3);
		for (let i = start; i < end; i++) {
			if (voice[i].el_type === "note") {
				if (voice[i].decoration) {
					for (let j = 0; j < voice[i].decoration.length; j++) {
						if (volumeDecorations.indexOf(voice[i].decoration[j]) >= 0)
							return voice[i].decoration[j];
					}
				}
			}
		}
		return null;
	}

	private insertTempoChanges(voices: any[][], tempoChanges: Record<string, any>) {
		const changePositions = Object.keys(tempoChanges);
		if (changePositions.length === 0) return;

		for (let i = 0; i < voices.length; i++) {
			const voice = voices[i];
			let lastTempo = tempoChanges['0'] ? tempoChanges['0'].qpm : 0;
			for (let j = 0; j < voice.length; j++) {
				const el = voice[j];
				if (el.el_type === "tempo")
					lastTempo = el.qpm;
				if (changePositions.indexOf('' + el.timing) >= 0 && lastTempo !== tempoChanges['' + el.timing].qpm) {
					lastTempo = tempoChanges['' + el.timing].qpm;
					if (el.el_type === "tempo") {
						el.qpm = tempoChanges['' + el.timing].qpm;
						j++;
					} else {
						voices[i].splice(j, 0, { el_type: "tempo", qpm: tempoChanges['' + el.timing].qpm, timing: el.timing });
						j += 2;
					}
				}
			}
		}
	}

	private chordVoiceOffThisBar(voices: any[][]) {
		for (let i = 0; i < voices.length; i++) {
			const voice = voices[i];
			let j = voice.length - 1;
			while (j >= 0 && voice[j].el_type !== 'bar') {
				voice[j].noChordVoice = true;
				j--;
			}
		}
	}

	private getTrackTitle(staff: any[], voiceNumber: number) {
		if (!staff || staff.length <= voiceNumber || !staff[voiceNumber].title)
			return undefined;
		return staff[voiceNumber].title.join(" ");
	}

	private interpretTempo(element: any, beatLength: number) {
		let duration = 1 / 4;
		if (element.duration) {
			duration = element.duration[0];
		}
		let bpm = 60;
		if (element.bpm) {
			bpm = element.bpm;
		}
		return duration * bpm / beatLength;
	}

	private interpretMeter(element: any) {
		let meter;
		switch (element.type) {
			case "common_time":
				meter = { el_type: 'meter', num: 4, den: 4 };
				this.measureLength = 4 / 4
				break;
			case "cut_time":
				meter = { el_type: 'meter', num: 2, den: 2 };
				this.measureLength = 2 / 2
				break;
			case "specified":
				let num = 0
				if (element.value && element.value.length > 0 && element.value[0].num.indexOf('+') > 0) {
					const parts = element.value[0].num.split('+')
					for (let i = 0; i < parts.length; i++)
						num += parseInt(parts[i], 10)
				} else
					num = parseInt(element.value[0].num, 10);
				meter = { el_type: 'meter', num: num, den: element.value[0].den };
				this.measureLength = num / parseInt(element.value[0].den, 10)
				break;
			default:
				meter = { el_type: 'meter' };
				this.measureLength = 1
		}
		return meter;
	}

	private removeNaturals(accidentals: any[]) {
		const acc = [];
		for (let i = 0; i < accidentals.length; i++) {
			if (accidentals[i].acc !== "natural")
				acc.push(accidentals[i])
		}
		return acc;
	}

	private addKey(arr: any[], key: any) {
		let newKey;
		if (key.root === 'HP')
			newKey = { el_type: 'key', accidentals: [{ acc: 'natural', note: 'g' }, { acc: 'sharp', note: 'f' }, { acc: 'sharp', note: 'c' }] };
		else
			newKey = { el_type: 'key', accidentals: this.removeNaturals(key.accidentals) };
		this.addIfDifferent(arr, newKey);
	}

	private addMeter(arr: any[], meter: any) {
		const newMeter = this.interpretMeter(meter);
		this.addIfDifferent(arr, newMeter);
	}

	private addIfDifferent(arr: any[], item: any) {
		for (let i = arr.length - 1; i >= 0; i--) {
			if (arr[i].el_type === item.el_type) {
				if (JSON.stringify(arr[i]) !== JSON.stringify(item))
					arr.push(item);
				return;
			}
		}
		arr.push(item);
	}
}

export default function sequence(abctune: any, options: any): any[] {
	const sequencer = new MidiSequencer();
	return sequencer.sequence(abctune, options);
}
