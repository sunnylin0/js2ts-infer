import RelativeElement from './elements/relative-element';
import spacing from '../helpers/spacing';
import translateChord from "./translate-chord";
const addChord = function (getTextSize: GetTextSize, abselem: AbsoluteElement, elem: any, roomTaken: number, roomTakenRight: number, noteheadWidth: number, jazzchords: boolean, germanAlphabet: boolean) {
    for (let i: number = 0; i < elem.chord.length; i++) {
        const pos = elem.chord[i].position;
        const rel_position = elem.chord[i].rel_position;
        const isAnnotation: boolean = pos === "left" || pos === "right" || pos === "below" || pos === "above" || !!rel_position;
        let font;
        let klass;
        if (isAnnotation) {
            font = 'annotationfont';
            klass = "abcjs-annotation";
        }
        else {
            font = 'gchordfont';
            klass = "abcjs-chord";
        }
        const attr = getTextSize.attr(font, klass);
        const name = elem.chord[i].name;
        let ret;
        if (typeof name === "string") {
            ret = chordString(name, pos, rel_position, isAnnotation, font, klass, attr, getTextSize, abselem, elem, roomTaken, roomTakenRight, noteheadWidth, jazzchords, germanAlphabet);
            roomTaken = ret.roomTaken;
            roomTakenRight = ret.roomTakenRight;
        }
        else {
            for (let j: number = 0; j < name.length; j++) {
                ret = chordString(name[j].text, pos, rel_position, isAnnotation, font, klass, attr, getTextSize, abselem, elem, roomTaken, roomTakenRight, noteheadWidth, jazzchords, germanAlphabet);
                roomTaken = ret.roomTaken;
                roomTakenRight = ret.roomTakenRight;
            }
        }
    }
    return { roomTaken: roomTaken, roomTakenRight: roomTakenRight };
};
function chordString(chordString: string, pos: string, rel_position: any, isAnnotation: boolean, font: string, klass: string, attr: any, getTextSize: GetTextSize, abselem: AbsoluteElement, elem: any, roomTaken: number, roomTakenRight: number, noteheadWidth: number, jazzchords: boolean, germanAlphabet: boolean) {
    const chords: Array<string> = chordString.split("\n");
    for (let j: number = chords.length - 1; j >= 0; j--) { // parse these in opposite order because we place them from bottom to top.
        let chord: string = chords[j];
        let x: number = 0;
        let y;
        if (!isAnnotation)
            chord = translateChord(chord, jazzchords, germanAlphabet);
        const dim = getTextSize.calc(chord, font, klass);
        const chordWidth: number = dim.width;
        const chordHeight: number = dim.height / spacing.STEP;
        switch (pos) {
            case "left":
                roomTaken += chordWidth + 7;
                x = -roomTaken; // TODO-PER: This is just a guess from trial and error
                y = elem.averagepitch;
                abselem.addExtra(new RelativeElement(chord, x, chordWidth + 4, y, {
                    type: "text",
                    height: chordHeight,
                    dim: attr,
                    position: "left"
                }));
                break;
            case "right":
                roomTakenRight += 4;
                x = roomTakenRight; // TODO-PER: This is just a guess from trial and error
                y = elem.averagepitch;
                abselem.addRight(new RelativeElement(chord, x, chordWidth + 4, y, {
                    type: "text",
                    height: chordHeight,
                    dim: attr,
                    position: "right"
                }));
                break;
            case "below":
                // setting the y-coordinate to undefined for now: it will be overwritten later on, after we figure out what the highest element on the line is.
                abselem.addRight(new RelativeElement(chord, 0, 0, undefined, {
                    type: "text",
                    position: "below",
                    height: chordHeight,
                    dim: attr,
                    realWidth: chordWidth
                }));
                break;
            case "above":
                // setting the y-coordinate to undefined for now: it will be overwritten later on, after we figure out what the highest element on the line is.
                abselem.addRight(new RelativeElement(chord, 0, 0, undefined, {
                    type: "text",
                    position: "above",
                    height: chordHeight,
                    dim: attr,
                    realWidth: chordWidth
                }));
                break;
            default:
                if (rel_position) {
                    const relPositionY = rel_position.y + 3 * spacing.STEP; // TODO-PER: this is a fudge factor to make it line up with abcm2ps
                    abselem.addRight(new RelativeElement(chord, x + rel_position.x, 0, elem.minpitch + relPositionY / spacing.STEP, {
                        position: "relative",
                        type: "text",
                        height: chordHeight,
                        dim: attr
                    }));
                }
                else {
                    // setting the y-coordinate to undefined for now: it will be overwritten later on, after we figure out what the highest element on the line is.
                    let pos2: string = 'above';
                    if (elem.positioning && elem.positioning.chordPosition)
                        pos2 = elem.positioning.chordPosition;
                    if (pos2 !== 'hidden') {
                        abselem.addCentered(new RelativeElement(chord, noteheadWidth / 2, chordWidth, undefined, {
                            type: "chord",
                            position: pos2,
                            height: chordHeight,
                            dim: attr,
                            realWidth: chordWidth
                        }));
                    }
                }
        }
    }
    return { roomTaken: roomTaken, roomTakenRight: roomTakenRight };
}
export default addChord;
