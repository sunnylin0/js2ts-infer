import AbsoluteElement from './elements/absolute-element';
import glyphs from './glyphs';
import RelativeElement from './elements/relative-element';
const createClef: AbsoluteElement = function (elem: any, tuneNumber: number): AbsoluteElement {
    let clef;
    let octave: number = 0;
    elem.el_type = "clef";
    const abselem: AbsoluteElement = new AbsoluteElement(elem, 0, 10, 'staff-extra clef', tuneNumber);
    abselem.isClef = true;
    switch (elem.type) {
        case "treble":
            clef = "clefs.G";
            break;
        case "tenor":
            clef = "clefs.C";
            break;
        case "alto":
            clef = "clefs.C";
            break;
        case "bass":
            clef = "clefs.F";
            break;
        case 'treble+8':
            clef = "clefs.G";
            octave = 1;
            break;
        case 'tenor+8':
            clef = "clefs.C";
            octave = 1;
            break;
        case 'bass+8':
            clef = "clefs.F";
            octave = 1;
            break;
        case 'alto+8':
            clef = "clefs.C";
            octave = 1;
            break;
        case 'treble-8':
            clef = "clefs.G";
            octave = -1;
            break;
        case 'tenor-8':
            clef = "clefs.C";
            octave = -1;
            break;
        case 'bass-8':
            clef = "clefs.F";
            octave = -1;
            break;
        case 'alto-8':
            clef = "clefs.C";
            octave = -1;
            break;
        case 'none': return null;
        case 'perc':
            clef = "clefs.perc";
            break;
        default: abselem.addFixed(new RelativeElement("clef=" + elem.type, 0, 0, undefined, { type: "debug" }));
    }
    const dx: number = 5;
    if (clef) {
        const height: number = glyphs.symbolHeightInPitches(clef);
        const ofs: number = clefOffsets(clef);
        abselem.addRight(new RelativeElement(clef, dx, glyphs.getSymbolWidth(clef), elem.clefPos, { top: height + elem.clefPos + ofs, bottom: elem.clefPos + ofs }));
        if (octave !== 0) {
            const scale: number = 2 / 3;
            const adjustspacing: number = (glyphs.getSymbolWidth(clef) - glyphs.getSymbolWidth("8") * scale) / 2;
            let pitch: number = (octave > 0) ? abselem.top + 3 : abselem.bottom - 1;
            const top: number = (octave > 0) ? abselem.top + 3 : abselem.bottom - 3;
            const bottom: number = top - 2;
            let currentAdjustSpacing: number = adjustspacing;
            if (elem.type === "bass-8") {
                // The placement for bass octave is a little different. It should hug the clef.
                pitch = 3;
                currentAdjustSpacing = 0;
            }
            abselem.addRight(new RelativeElement("8", dx + currentAdjustSpacing, glyphs.getSymbolWidth("8") * scale, pitch, {
                scalex: scale,
                scaley: scale,
                top: top,
                bottom: bottom
            }));
        }
    }
    return abselem;
};
function clefOffsets(clef: string): number {
    switch (clef) {
        case "clefs.G": return -5;
        case "clefs.C": return -4;
        case "clefs.F": return -4;
        case "clefs.perc": return -2;
        default: return 0;
    }
}
export default createClef;
