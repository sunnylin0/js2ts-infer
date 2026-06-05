import AbsoluteElement from './elements/absolute-element';
import glyphs from './glyphs';
import RelativeElement from './elements/relative-element';

const createKeySignature = function (elem: any, tuneNumber: number): AbsoluteElement | null {
	elem.el_type = "keySignature";
	if (!elem.accidentals || elem.accidentals.length === 0)
		return null;
	const abselem: any = new AbsoluteElement(elem, 0, 10, 'staff-extra key-signature', tuneNumber);
	abselem.isKeySig = true;
	let dx = 0;
	elem.accidentals.forEach(function (acc: any) {
		let symbol: string;
		let fudge = 0;
		switch (acc.acc) {
			case "sharp": symbol = "accidentals.sharp"; fudge = -3; break;
			case "natural": symbol = "accidentals.nat"; break;
			case "flat": symbol = "accidentals.flat"; fudge = -1.2; break;
			case "quartersharp": symbol = "accidentals.halfsharp"; fudge = -2.5; break;
			case "quarterflat": symbol = "accidentals.halfflat"; fudge = -1.2; break;
			default: symbol = "accidentals.flat";
		}
		abselem.addRight(new RelativeElement(symbol, dx, glyphs.getSymbolWidth(symbol), acc.verticalPos, { thickness: glyphs.symbolHeightInPitches(symbol), top: acc.verticalPos + glyphs.symbolHeightInPitches(symbol) + fudge, bottom: acc.verticalPos + fudge }));
		dx += glyphs.getSymbolWidth(symbol) + 2;
	});
	return abselem;
};

export default createKeySignature;
