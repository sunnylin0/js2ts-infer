// This takes a visual object and returns an object that can
// be rotely turned into a chord grid.
//
// 1) It will always be 8 measures on a line, unless it is a 12 bar blues, then it will be 4 measures.
// 2) If it is not in 4/4 it will return an error
// 3) If there are no chords it will return an error
// 4) It will be divided into parts with the part title and an array of measures
// 5) |: and :| will be included in a measure
// 6) If there are first and second endings and the chords are the same, then collapse them
// 7) If there are first and second endings and the chords are different, use a separate line for the second ending and right justify it.
// 8) If there is one chord per measure and it is repeated in the next measure use a % for the second measure.
// 9) All lines are the same height, so they are tall enough to fit two lines if there lots of chords
// 10) Chords will be printed as large as they can without overlapping, so different chords will be smaller if they are long.
// 11) If there are two chords per measure then there is a slash between them.
// 12) If there are three or four chords then there is a 2x2 grid with the chords reading right to left. For three chords, leave the repeated cell blank.
// 13) Breaks are indicated by the word "break" or "N.C.". A break that extends to the next measure is indicated by three dots in the next measure.
// 14) Ignore pickup notes
// 15) if a part is not a multiple of 8 bars (and not 12 bars), the last line has
// 4 squares on left and not any grid on the right.
// 16) Annotations and some decorations get printed above the cells.

export default function chordGrid(visualObj: any): any[] {
	const meter = visualObj.getMeterFraction();
	const isCommonTime = meter.num === 4 && meter.den === 4;
	const isCutTime = meter.num === 2 && meter.den === 2;
	if (!isCutTime && !isCommonTime)
		throw new Error("notCommonTime");
	const deline = visualObj.deline();

	let chartLines: any[] = [];

	let nonSubtitle = false;
	deline.forEach((section: any) => {
		if (section.subtitle) {
			if (nonSubtitle) {
				chartLines.push({
					type: "subtitle",
					subtitle: section.subtitle.text
				});
			}
		} else if (section.text) {
			nonSubtitle = true;
			chartLines.push({
				type: "text",
				text: section.text.text
			});
		} else if (section.staff) {
			nonSubtitle = true;
			const staves = section.staff;
			const parts = flattenVoices(staves);

			chartLines = chartLines.concat(parts);
		}
	});
	collapseIdenticalEndings(chartLines);
	addLineBreaks(chartLines);
	addPercents(chartLines);
	return chartLines;
}

const breakSynonyms = ['break', '(break)', 'no chord', 'n.c.', 'tacet'];

function flattenVoices(staves: any[]): any[] {
	const parts: any[] = [];
	let partName = "";
	let measures: any[] = [];
	let currentBar: any = { chord: ['', '', '', ''] };
	let lastChord = "";
	let nextBarEnding = "";
	staves.forEach((staff, staffNum) => {
		if (staff.voices) {
			staff.voices.forEach((voice: any[], voiceNum: number) => {
				let beatNum = 0;
				let measureNum = 0;
				voice.forEach(element => {
					if (element.el_type === 'part') {
						if (measures.length > 0) {
							if (staffNum === 0 && voiceNum === 0) {
								parts.push({
									type: "part",
									name: partName,
									lines: [measures]
								});
								measures = [];
							}
						}
						partName = element.title;
					} else if (element.el_type === 'note') {
						addDecoration(element, currentBar);
						const intBeat = Math.floor(beatNum);
						if (element.chord && element.chord.length > 0) {
							const chord = element.chord[0];
							const chordName = chord.position === 'default' || breakSynonyms.indexOf(chord.name.toLowerCase()) >= 0 ? chord.name : '';
							if (chordName) {
								if (intBeat > 0 && !currentBar.chord[0])
									currentBar.chord[0] = lastChord;
								lastChord = chordName;
								if (currentBar.chord[intBeat]) {
									if (intBeat < 4 && !currentBar.chord[intBeat + 1])
										currentBar.chord[intBeat + 1] = chordName;
								} else
									currentBar.chord[intBeat] = chordName;
							}
							element.chord.forEach((ch: any) => {
								if (ch.position !== 'default' && breakSynonyms.indexOf(chord.name.toLowerCase()) < 0) {
									if (!currentBar.annotations)
										currentBar.annotations = [];
									currentBar.annotations.push(ch.name);
								}
							});
						}
						if (!element.rest || element.rest.type !== 'spacer') {
							const dur = element.duration === 0 && !element.rest ? 0.25 : element.duration;
							const thisDuration = Math.floor(dur * 4);
							if (thisDuration > 4) {
								measureNum += Math.floor(thisDuration / 4);
								beatNum = 0;
							} else {
								let thisBeat = dur * 4;
								if (element.tripletMultiplier)
									thisBeat *= element.tripletMultiplier;
								beatNum += thisBeat;
							}
						}
					} else if (element.el_type === 'bar') {
						if (nextBarEnding) {
							currentBar.ending = nextBarEnding;
							nextBarEnding = "";
						}
						addDecoration(element, currentBar);
						if (element.chord) {
							element.chord.forEach((ch: any) => {
								if (ch.position !== 'default') {
									if (!currentBar.annotations)
										currentBar.annotations = [];
									currentBar.annotations.push(ch.name);
								}
							});
						}
						if (element.type === 'bar_dbl_repeat' || element.type === 'bar_left_repeat')
							currentBar.hasStartRepeat = true;
						if (element.type === 'bar_dbl_repeat' || element.type === 'bar_right_repeat')
							currentBar.hasEndRepeat = true;
						if (element.startEnding)
							nextBarEnding = element.startEnding;
						if (beatNum >= 4) {
							if (currentBar.chord[0] === '') {
								if (currentBar.chord[1] || currentBar.chord[2] || currentBar.chord[3]) {
									currentBar.chord[0] = findLastChord(measures);
								}
							}
							if (staffNum === 0 && voiceNum === 0)
								measures.push(currentBar);
							else {
								let index = measureNum;
								let partIndex = 0;
								while (index >= parts[partIndex].lines[0].length && partIndex < parts.length) {
									index -= parts[partIndex].lines[0].length;
									partIndex++;
								}
								if (partIndex < parts.length && index < parts[partIndex].lines[0].length) {
									const bar = parts[partIndex].lines[0][index];
									if (!bar.chord[0] && currentBar.chord[0])
										bar.chord[0] = currentBar.chord[0];
									if (!bar.chord[1] && currentBar.chord[1])
										bar.chord[1] = currentBar.chord[1];
									if (!bar.chord[2] && currentBar.chord[2])
										bar.chord[2] = currentBar.chord[2];
									if (!bar.chord[3] && currentBar.chord[3])
										bar.chord[3] = currentBar.chord[3];
									if (currentBar.annotations) {
										if (!bar.annotations)
											bar.annotations = currentBar.annotations;
										else
											bar.annotations = bar.annotations.concat(currentBar.annotations);
									}
								}
								measureNum++;
							}
							currentBar = { chord: ['', '', '', ''] };
						} else
							currentBar.chord = ['', '', '', ''];
						beatNum = 0;
					} else if (element.el_type === 'tempo') {
						// TODO-PER: should probably report tempo, too
					}
				});
				if (staffNum === 0 && voiceNum === 0) {
					parts.push({
						type: "part",
						name: partName,
						lines: [measures]
					});
				}
			});
		}
	});
	if (!lastChord)
		throw new Error("noChords");
	return parts;
}

function findLastChord(measures: any[]): string | undefined {
	for (let m = measures.length - 1; m >= 0; m--) {
		for (let c = measures[m].chord.length - 1; c >= 0; c--) {
			if (measures[m].chord[c])
				return measures[m].chord[c];
		}
	}
	return undefined;
}

function collapseIdenticalEndings(chartLines: any[]): void {
	chartLines.forEach(line => {
		if (line.type === "part") {
			const partLine = line.lines[0];
			const ending1 = partLine.findIndex((bar: any) => {
				return !!bar.ending;
			});
			const ending2 = partLine.findIndex((bar: any, index: number) => {
				return index > ending1 && !!bar.ending;
			});
			if (ending1 >= 0 && ending2 >= 0) {
				if (ending2 - ending1 === partLine.length - ending2) {
					let matches = true;
					for (let i = 0; i < ending2 - ending1 && matches; i++) {
						const measureLhs = partLine[ending1 + i];
						const measureRhs = partLine[ending2 + i];
						if (measureLhs.chord[0] !== measureRhs.chord[0])
							matches = false;
						if (measureLhs.chord[1] !== measureRhs.chord[1])
							matches = false;
						if (measureLhs.chord[2] !== measureRhs.chord[2])
							matches = false;
						if (measureLhs.chord[3] !== measureRhs.chord[3])
							matches = false;
						if (measureLhs.annotations && !measureRhs.annotations)
							matches = false;
						if (!measureLhs.annotations && measureRhs.annotations)
							matches = false;
						if (measureLhs.annotations && measureRhs.annotations) {
							if (measureLhs.annotations.length !== measureRhs.annotations.length)
								matches = false;
							else {
								for (let j = 0; j < measureLhs.annotations.length; j++) {
									if (measureLhs.annotations[j] !== measureRhs.annotations[j])
										matches = false;
								}
							}
						}
					}
					if (matches) {
						delete partLine[ending1].ending;
						partLine.splice(ending2, partLine.length - ending2);
					}
				}
			}
		}
	});
}

function addLineBreaks(chartLines: any[]): void {
	chartLines.forEach(line => {
		if (line.type === "part") {
			const newLines: any[] = [];
			const oldLines = line.lines[0];
			let is12bar = false;
			const firstEndRepeat = oldLines.findIndex((l: any) => {
				return !!l.hasEndRepeat;
			});
			const length = firstEndRepeat >= 0 ? Math.min(firstEndRepeat + 1, oldLines.length) : oldLines.length;
			if (length === 12)
				is12bar = true;
			const barsPerLine = is12bar ? 4 : 8;
			for (let i = 0; i < oldLines.length; i += barsPerLine) {
				const newLine = oldLines.slice(i, i + barsPerLine);
				const endRepeat = newLine.findIndex((l: any) => {
					return !!l.hasEndRepeat;
				});
				if (endRepeat >= 0 && endRepeat < newLine.length - 1) {
					newLines.push(newLine.slice(0, endRepeat + 1));
					newLines.push(newLine.slice(endRepeat + 1));
				} else
					newLines.push(newLine);
			}
			for (let i = 0; i < newLines.length; i++) {
				if (newLines[i][0].ending) {
					const prevLine = Math.max(0, i - 1);
					const toAdd = newLines[prevLine].length - newLines[i].length;
					const thisLine: any[] = [];
					for (let j = 0; j < toAdd; j++)
						thisLine.push({ noBorder: true, chord: ['', '', '', ''] });
					newLines[i] = thisLine.concat(newLines[i]);
				}
			}
			line.lines = newLines;
		}
	});
}

function addPercents(chartLines: any[]): void {
	chartLines.forEach(part => {
		if (part.lines) {
			let lastMeasureSingle = false;
			let lastChord = "";
			part.lines.forEach((line: any[]) => {
				line.forEach(measure => {
					if (!measure.noBorder) {
						const chords = measure.chord;
						if (!chords[0] && !chords[1] && !chords[2] && !chords[3]) {
							if (lastMeasureSingle) {
								if (lastChord)
									chords[0] = '%';
							} else
								chords[0] = lastChord;
							lastMeasureSingle = true;
						} else if (!chords[1] && !chords[2] && !chords[3]) {
							lastMeasureSingle = true;
							lastChord = chords[0];
						} else {
							lastMeasureSingle = false;
							lastChord = chords[3] || chords[2] || chords[1];
						}
					}
				});
			});
		}
	});
}

function addDecoration(element: any, currentBar: any): void {
	if (element.decoration) {
		for (let i = 0; i < element.decoration.length; i++) {
			switch (element.decoration[i]) {
				case 'fermata':
				case 'segno':
				case 'coda':
				case "D.C.":
				case "D.S.":
				case "D.C.alcoda":
				case "D.C.alfine":
				case "D.S.alcoda":
				case "D.S.alfine":
				case "fine":
					if (!currentBar.annotations)
						currentBar.annotations = [];
					currentBar.annotations.push(element.decoration[i]);
					break;
			}
		}
	}
}
