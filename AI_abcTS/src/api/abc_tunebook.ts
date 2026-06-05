//    abc_tunebook.ts: splits a string representing ABC Music Notation into individual tunes.

import { TuneObject, AnalyzedTune } from 'abcjs';
import Parse from '../parse/abc_parse';
import bookParser from '../parse/abc_parse_book';
import tablatures from '../tablatures/abc_tablatures';

export function numberOfTunes(abc: string): number {
	var tunes = abc.split("\nX:");
	var num = tunes.length;
	if (num === 0) num = 1;
	return num;
}

export class TuneBook {
	public header: string;
	public tunes: AnalyzedTune[];

	constructor(book: string) {
		var parsed = bookParser(book);
		this.header = parsed.header;
		this.tunes = parsed.tunes;
	}

	getTuneById(id: string | number): AnalyzedTune | null {
		for (var i = 0; i < this.tunes.length; i++) {
			if (this.tunes[i].id === '' + id)
				return this.tunes[i];
		}
		return null;
	}

	getTuneByTitle(title: string): AnalyzedTune | null {
		for (var i = 0; i < this.tunes.length; i++) {
			if (this.tunes[i].title === title)
				return this.tunes[i];
		}
		return null;
	}
}

export function parseOnly(abc: string, params: any): any[] {
	var numTunes = numberOfTunes(abc);

	// this just needs to be passed in because this tells the engine how many tunes to process.
	var output = [];
	for (var i = 0; i < numTunes; i++) {
		output.push(1);
	}
	function callback() {
		// Don't need to do anything with the parsed tunes.
	}
	return renderEngine(callback, output, abc, params);
}

export function renderEngine(callback: any, output: any, abc: string, params: any): any[] {
	var ret: any[] = [];
	var isArray = function (testObject: any) {
		return testObject && !(testObject.propertyIsEnumerable('length')) && typeof testObject === 'object' && typeof testObject.length === 'number';
	};

	// check and normalize input parameters
	if (output === undefined || abc === undefined)
		return [];
	if (!isArray(output))
		output = [output];
	if (params === undefined)
		params = {};
	var currentTune = params.startingTune ? parseInt(params.startingTune, 10) : 0;

	// parse the abc string
	var book = new TuneBook(abc);
	var abcParser = new Parse();

	// output each tune, if it exists. Otherwise clear the div.
	for (var i = 0; i < output.length; i++) {
		var div = output[i];
		if (div === "*") {
			// This is for "headless" rendering: doing the work but not showing the svg.
		} else if (typeof (div) === "string")
			div = document.getElementById(div);
		if (div) {
			if (currentTune >= 0 && currentTune < book.tunes.length) {
				abcParser.parse(book.tunes[currentTune].abc, params, book.tunes[currentTune].startPos - book.header.length);
				var tune: TuneObject = abcParser.getTune();
				//
				// Init tablatures plugins
				//
				if (params.tablature) {
					tune.tablatures = tablatures.preparePlugins(tune, currentTune, params);
				}
				var warnings = abcParser.getWarnings();
				if (warnings)
					tune.warnings = warnings;
				var override = callback(div, tune, i, book.tunes[currentTune].abc);
				ret.push(override ? override : tune);
			} else {
				if (div['innerHTML'])
					div.innerHTML = "";
			}
		}
		currentTune++;
	}
	return ret;
}

export function extractMeasures(abc: any): any[] {
	var tunes: any[] = [];
	var book = new TuneBook(abc);
	for (var i = 0; i < book.tunes.length; i++) {
		var tune = book.tunes[i];
		var arr = tune.abc.split("K:");
		var arr2 = arr[1].split("\n");
		var header = arr[0] + "K:" + arr2[0] + "\n";
		var lastChord = null;
		var measureStartChord = null;
		var fragStart = null;
		var measures: any[] = [];
		var hasNotes = false;
		var tuneObj = parseOnly(tune.abc, {})[0];
		var hasPickup = tuneObj.getPickupLength() > 0;

		for (var j = 0; j < tuneObj.lines.length; j++) {
			var line = tuneObj.lines[j];
			if (line.staff) {
				for (var k = 0; k < 1; k++) {
					var staff = line.staff[k];
					for (var kk = 0; kk < 1; kk++) {
						var voice = staff.voices[kk];
						for (var kkk = 0; kkk < voice.length; kkk++) {
							var elem = voice[kkk];
							if (fragStart === null && elem.startChar >= 0) {
								fragStart = elem.startChar;
								if (elem.chord === undefined)
									measureStartChord = lastChord;
								else
									measureStartChord = null;
							}
							if (elem.chord)
								lastChord = elem;
							if (elem.el_type === 'bar') {
								if (hasNotes) {
									var frag = tune.abc.substring(fragStart, elem.endChar);
									var measure: any = { abc: frag };
									lastChord = measureStartChord && measureStartChord.chord && measureStartChord.chord.length > 0 ? measureStartChord.chord[0].name : null;
									if (lastChord)
										measure.lastChord = lastChord;
									if (elem.startEnding)
										measure.startEnding = elem.startEnding;
									if (elem.endEnding)
										measure.endEnding = elem.endEnding;
									measures.push(measure);
									fragStart = null;
									hasNotes = false;
								}
							} else if (elem.el_type === 'note') {
								hasNotes = true;
							}
						}
					}
				}
			}
		}
		tunes.push({
			header: header,
			measures: measures,
			hasPickup: hasPickup
		});
	}
	return tunes;
}

const tunebook = {
	numberOfTunes,
	TuneBook,
	parseOnly,
	renderEngine,
	extractMeasures
};

export default tunebook;
