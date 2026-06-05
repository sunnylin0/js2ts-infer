import DynamicDecoration from './elements/dynamic-decoration';
import CrescendoElem from './elements/crescendo-element';
import GlissandoElem from './elements/glissando-element';
import glyphs from './glyphs';
import RelativeElement from './elements/relative-element';
import TieElem from './elements/tie-element';
import { AbsoluteElement, Voice } from '../draw/type-definitions';

class Decoration {
	public startDiminuendoX: AbsoluteElement | undefined;
	public startCrescendoX: AbsoluteElement | undefined;
	public startGlissandoX: AbsoluteElement | undefined;
	public minTop = 12;
	public minBottom = 0;
	public dynamicPositioning: any;

	constructor() {
		this.startDiminuendoX = undefined;
		this.startCrescendoX = undefined;
		this.minTop = 12;
		this.minBottom = 0;
	}

	public endLine(voice: Voice): void {
		if (this.startDiminuendoX) {
			voice.addOther(new CrescendoElem(this.startDiminuendoX, lastNote(voice.children), ">", this.dynamicPositioning));
			this.startDiminuendoX = undefined;
		}
		if (this.startCrescendoX) {
			voice.addOther(new CrescendoElem(this.startCrescendoX, lastNote(voice.children), "<", this.dynamicPositioning));
			this.startCrescendoX = undefined;
		}
	}

	public dynamicDecoration(voice: Voice, decoration: string[], abselem: AbsoluteElement, positioning: any): void {
		let diminuendo: { start: AbsoluteElement, stop: AbsoluteElement } | undefined;
		let crescendo: { start: AbsoluteElement, stop: AbsoluteElement } | undefined;
		let glissando: { start: AbsoluteElement, stop: AbsoluteElement } | undefined;

		for (let i = 0; i < decoration.length; i++) {
			switch (decoration[i]) {
				case "diminuendo(":
					this.startDiminuendoX = abselem;
					this.dynamicPositioning = positioning;
					diminuendo = undefined;
					break;
				case "diminuendo)":
					if (!this.startDiminuendoX)
						this.startDiminuendoX = firstNote(voice.children) as AbsoluteElement;
					diminuendo = { start: this.startDiminuendoX, stop: abselem };
					this.startDiminuendoX = undefined;
					break;
				case "crescendo(":
					this.startCrescendoX = abselem;
					this.dynamicPositioning = positioning;
					crescendo = undefined;
					break;
				case "crescendo)":
					if (!this.startCrescendoX)
						this.startCrescendoX = firstNote(voice.children) as AbsoluteElement;
					crescendo = { start: this.startCrescendoX, stop: abselem };
					this.startCrescendoX = undefined;
					break;
				case '~(':
				case "glissando(":
					this.startGlissandoX = abselem;
					glissando = undefined;
					break;
				case '~)':
				case "glissando)":
					if (this.startGlissandoX) {
						glissando = { start: this.startGlissandoX, stop: abselem };
						this.startGlissandoX = undefined;
					}
					break;
			}
		}
		if (diminuendo) {
			voice.addOther(new CrescendoElem(diminuendo.start, diminuendo.stop, ">", positioning));
		}
		if (crescendo) {
			voice.addOther(new CrescendoElem(crescendo.start, crescendo.stop, "<", positioning));
		}
		if (glissando) {
			voice.addOther(new GlissandoElem(glissando.start, glissando.stop));
		}
	}

	public createDecoration(voice: Voice, decoration: string[], pitch: number, width: number, abselem: any, roomtaken: number, dir: 'up' | 'down', minPitch: number, positioning: any, hasVocals: boolean, accentAbove: boolean): void {
		if (!positioning)
			positioning = { ornamentPosition: 'above', volumePosition: hasVocals ? 'above' : 'below', dynamicPosition: hasVocals ? 'above' : 'below' };

		volumeDecoration(voice, decoration, abselem, positioning.volumePosition);
		this.dynamicDecoration(voice, decoration, abselem as any, positioning.dynamicPosition);
		compoundDecoration(decoration, pitch, width, abselem, dir);

		const yPos = closeDecoration(voice, decoration, pitch, width, abselem, roomtaken, dir, minPitch, accentAbove);

		yPos.above = Math.max(yPos.above, this.minTop);
		yPos.below = Math.min(yPos.below, minPitch);
		stackedDecoration(decoration, width, abselem, yPos, positioning.ornamentPosition, this.minTop, minPitch, accentAbove);
		leftDecoration(decoration, abselem, roomtaken);
	}
}

function closeDecoration(voice: Voice, decoration: string[], pitch: number, width: number, abselem: any, roomtaken: number, dir: 'up' | 'down', minPitch: number, accentAbove: boolean): { above: number, below: number } {
	let yPos: number | undefined;
	for (let i = 0; i < decoration.length; i++) {
		if (decoration[i] === "staccato" || decoration[i] === "tenuto" || (decoration[i] === "accent" && !accentAbove)) {
			let symbol = "scripts." + decoration[i];
			if (decoration[i] === "accent") symbol = "scripts.sforzato";
			if (yPos === undefined)
				yPos = (dir === "down") ? pitch + 2 : minPitch - 2;
			else
				yPos = (dir === "down") ? yPos + 2 : yPos - 2;
			if (decoration[i] === "accent") {
				if (dir === "up") yPos--;
				else yPos++;
			} else {
				switch (yPos) {
					case 2:
					case 4:
					case 6:
					case 8:
					case 10:
						if (dir === "up") yPos--;
						else yPos++;
						break;
				}
			}
			if (pitch > 9) yPos++;
			let deltaX = width / 2;
			if (glyphs.getSymbolAlign(symbol) !== "center") {
				deltaX -= (glyphs.getSymbolWidth(symbol) / 2);
			}
			abselem.addFixedX(new RelativeElement(symbol, deltaX, glyphs.getSymbolWidth(symbol), yPos));
		}
		if (decoration[i] === "slide" && abselem.heads[0]) {
			let yPos2 = abselem.heads[0].pitch;
			yPos2 -= 2;
			const blank1 = new RelativeElement("", -roomtaken - 15, 0, yPos2 - 1);
			const blank2 = new RelativeElement("", -roomtaken - 5, 0, yPos2 + 1);
			abselem.addFixedX(blank1);
			abselem.addFixedX(blank2);
			voice.addOther(new TieElem({ anchor1: blank1, anchor2: blank2, fixedY: true }));
		}
	}
	if (yPos === undefined)
		yPos = pitch;

	return { above: yPos, below: abselem.bottom };
}

function volumeDecoration(voice: Voice, decoration: string[], abselem: any, positioning: any): void {
	for (let i = 0; i < decoration.length; i++) {
		switch (decoration[i]) {
			case "p":
			case "mp":
			case "pp":
			case "ppp":
			case "pppp":
			case "f":
			case "ff":
			case "fff":
			case "ffff":
			case "sfz":
			case "mf":
				const elem = new DynamicDecoration(abselem, decoration[i], positioning);
				voice.addOther(elem);
		}
	}
}

function compoundDecoration(decoration: string[], pitch: number, width: number, abselem: any, dir: 'up' | 'down'): void {
	function highestPitch() {
		if (abselem.heads.length === 0)
			return 10;
		let p = abselem.heads[0].pitch;
		for (let i = 1; i < abselem.heads.length; i++)
			p = Math.max(p, abselem.heads[i].pitch);
		return p;
	}
	function lowestPitch() {
		if (abselem.heads.length === 0)
			return 2;
		let p = abselem.heads[0].pitch;
		for (let i = 1; i < abselem.heads.length; i++)
			p = Math.min(p, abselem.heads[i].pitch);
		return p;
	}
	function addCompound(symbol: string, count: number) {
		let placement = (dir === 'down') ? lowestPitch() + 1 : highestPitch() + 9;
		if (dir !== 'down' && count === 1)
			placement--;
		let deltaX = width / 2;
		deltaX += (dir === 'down') ? -5 : 3;
		for (let i = 0; i < count; i++) {
			placement -= 1;
			abselem.addFixedX(new RelativeElement(symbol, deltaX, glyphs.getSymbolWidth(symbol), placement));
		}
	}

	for (let i = 0; i < decoration.length; i++) {
		switch (decoration[i]) {
			case "/": addCompound("flags.ugrace", 1); break;
			case "//": addCompound("flags.ugrace", 2); break;
			case "///": addCompound("flags.ugrace", 3); break;
			case "////": addCompound("flags.ugrace", 4); break;
		}
	}
}

function stackedDecoration(decoration: string[], width: number, abselem: any, yPos: { above: number, below: number }, positioning: 'above' | 'below', minTop: number, minBottom: number, accentAbove: boolean): boolean {
	function incrementPlacement(placement: 'above' | 'below', height: number) {
		if (placement === 'above')
			yPos.above += height;
		else
			yPos.below -= height;
	}
	function getPlacement(placement: 'above' | 'below') {
		let y;
		if (placement === 'above') {
			y = yPos.above;
			if (y < minTop)
				y = minTop;
		} else {
			y = yPos.below;
			if (y > minBottom)
				y = minBottom;
		}
		return y;
	}
	function textDec(text: string, placement: 'above' | 'below', anchor: 'start' | 'middle' | 'end') {
		const y = getPlacement(placement);
		const textFudge = 2;
		const textHeight = 5;
		abselem.addFixedX(new RelativeElement(text, width / 2, 0, y + textFudge, { type: "decoration", klass: 'ornament', thickness: 3, anchor: anchor }));
		incrementPlacement(placement, textHeight);
	}
	function symbolDec(symbol: string, placement: 'above' | 'below') {
		let deltaX = width / 2;
		if (glyphs.getSymbolAlign(symbol) !== "center") {
			deltaX -= (glyphs.getSymbolWidth(symbol) / 2);
		}
		const height = glyphs.symbolHeightInPitches(symbol) + 1;
		let y = getPlacement(placement);
		y = (placement === 'above') ? y + height / 2 : y - height / 2;
		abselem.addFixedX(new RelativeElement(symbol, deltaX, glyphs.getSymbolWidth(symbol), y, { klass: 'ornament', thickness: glyphs.symbolHeightInPitches(symbol), position: placement }));
		incrementPlacement(placement, height);
	}

	const symbolList: Record<string, string> = {
		"+": "scripts.stopped",
		"open": "scripts.open",
		"snap": "scripts.snap",
		"wedge": "scripts.wedge",
		"thumb": "scripts.thumb",
		"shortphrase": "scripts.shortphrase",
		"mediumphrase": "scripts.mediumphrase",
		"longphrase": "scripts.longphrase",
		"trill": "scripts.trill",
		"trillh": "scripts.trill",
		"roll": "scripts.roll",
		"irishroll": "scripts.roll",
		"marcato": "scripts.umarcato",
		"dmarcato": "scripts.dmarcato",
		"umarcato": "scripts.umarcato",
		"turn": "scripts.turn",
		"uppermordent": "scripts.prall",
		"pralltriller": "scripts.prall",
		"mordent": "scripts.mordent",
		"lowermordent": "scripts.mordent",
		"downbow": "scripts.downbow",
		"upbow": "scripts.upbow",
		"fermata": "scripts.ufermata",
		"invertedfermata": "scripts.dfermata",
		"breath": ",",
		"coda": "scripts.coda",
		"segno": "scripts.segno"
	};

	let hasOne = false;
	for (let i = 0; i < decoration.length; i++) {
		switch (decoration[i]) {
			case "0":
			case "1":
			case "2":
			case "3":
			case "4":
			case "5":
			case "D.C.":
			case "D.S.":
				textDec(decoration[i], positioning, 'middle');
				hasOne = true;
				break;
			case "D.C.alcoda":
				textDec("D.C. al coda", positioning, 'end');
				hasOne = true;
				break;
			case "D.C.alfine":
				textDec("D.C. al fine", positioning, 'end');
				hasOne = true;
				break;
			case "D.S.alcoda":
				textDec("D.S. al coda", positioning, 'end');
				hasOne = true;
				break;
			case "D.S.alfine":
				textDec("D.S. al fine", positioning, 'end');
				hasOne = true;
				break;
			case "fine":
				textDec("FINE", positioning, 'middle');
				hasOne = true;
				break;
			case "+":
			case "open":
			case "snap":
			case "wedge":
			case "thumb":
			case "shortphrase":
			case "mediumphrase":
			case "longphrase":
			case "trill":
			case "trillh":
			case "roll":
			case "irishroll":
			case "marcato":
			case "dmarcato":
			case "turn":
			case "uppermordent":
			case "pralltriller":
			case "mordent":
			case "lowermordent":
			case "downbow":
			case "upbow":
			case "fermata":
			case "breath":
			case "umarcato":
			case "coda":
			case "segno":
				symbolDec(symbolList[decoration[i]], positioning);
				hasOne = true;
				break;
			case "invertedfermata":
				symbolDec(symbolList[decoration[i]], 'below');
				hasOne = true;
				break;
			case "mark":
				abselem.klass = "mark";
				break;
			case "accent":
				if (accentAbove) {
					symbolDec("scripts.sforzato", positioning);
					hasOne = true;
				}
				break;
		}
	}
	return hasOne;
}

function leftDecoration(decoration: string[], abselem: any, roomtaken: number): void {
	for (let i = 0; i < decoration.length; i++) {
		switch (decoration[i]) {
			case "arpeggio":
				for (let j = abselem.abcelem.minpitch - 1; j <= abselem.abcelem.maxpitch; j += 2) {
					abselem.addExtra(
						new RelativeElement(
							"scripts.arpeggio",
							-glyphs.getSymbolWidth("scripts.arpeggio") * 2 - roomtaken,
							0,
							j + 2,
							{ klass: 'ornament', thickness: glyphs.symbolHeightInPitches("scripts.arpeggio") }
						)
					);
				}
				break;
		}
	}
}

function firstNote(els: any[]): any {
	for (let i = 0; i < els.length; i++) {
		if (els[i].abcelem && els[i].abcelem.pitches)
			return els[i];
	}
	return null;
}

function lastNote(els: any[]): any {
	return els[els.length - 1];
}

export default Decoration;
