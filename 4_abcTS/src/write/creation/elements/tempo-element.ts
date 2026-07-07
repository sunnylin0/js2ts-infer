import AbsoluteElement from './absolute-element';
import RelativeElement from './relative-element';
class TempoElement {
    note: any;
    tuneNumber: any;
    tempo: any;
    type = "TempoElement";
    totalHeightInPitches = 6;
    tempoHeightAbove = 6;
    x = 0;
    pitch = undefined;

    constructor(tempo: any, tuneNumber: number, createNoteHead: any) {
        this.tempo = tempo;
        this.tempo.type = "tempo";
        this.tuneNumber = tuneNumber;
        if (this.tempo.duration && !this.tempo.suppressBpm) {
            this.note = this.createNote(createNoteHead, tempo, tuneNumber);
        }
    }
    setX(x: number): void {
        this.x = x;
    }
    createNote(createNoteHead: any, tempo: any, tuneNumber: number): AbsoluteElement {
        const temposcale: number = 0.75;
        const duration: number = tempo.duration[0];
        const absElem: AbsoluteElement = new AbsoluteElement(tempo, duration, 1, 'tempo', tuneNumber);
        let dot;
        let flag;
        let note;
        if (duration <= 1 / 32) {
            note = "noteheads.quarter";
            flag = "flags.u32nd";
            dot = 0;
        }
        else if (duration <= 1 / 16) {
            note = "noteheads.quarter";
            flag = "flags.u16th";
            dot = 0;
        }
        else if (duration <= 3 / 32) {
            note = "noteheads.quarter";
            flag = "flags.u16nd";
            dot = 1;
        }
        else if (duration <= 1 / 8) {
            note = "noteheads.quarter";
            flag = "flags.u8th";
            dot = 0;
        }
        else if (duration <= 3 / 16) {
            note = "noteheads.quarter";
            flag = "flags.u8th";
            dot = 1;
        }
        else if (duration <= 1 / 4) {
            note = "noteheads.quarter";
            dot = 0;
        }
        else if (duration <= 3 / 8) {
            note = "noteheads.quarter";
            dot = 1;
        }
        else if (duration <= 1 / 2) {
            note = "noteheads.half";
            dot = 0;
        }
        else if (duration <= 3 / 4) {
            note = "noteheads.half";
            dot = 1;
        }
        else if (duration <= 1) {
            note = "noteheads.whole";
            dot = 0;
        }
        else if (duration <= 1.5) {
            note = "noteheads.whole";
            dot = 1;
        }
        else if (duration <= 2) {
            note = "noteheads.dbl";
            dot = 0;
        }
        else {
            note = "noteheads.dbl";
            dot = 1;
        }
        const ret = createNoteHead(absElem, note, { verticalPos: 0 }, { dir: "up", flag: flag, dot: dot, scale: temposcale });
        const tempoNote: RelativeElement = ret.notehead;
        absElem.addHead(tempoNote);
        if (note !== "noteheads.whole" && note !== "noteheads.dbl") {
            const p1: number = 1 / 3 * temposcale;
            const p2: number = 5 * temposcale;
            const dx: number = tempoNote.dx + tempoNote.w;
            const width: number = -0.6;
            const stem: RelativeElement = new RelativeElement(null, dx, 0, p1, { "type": "stem", "pitch2": p2, linewidth: width });
            absElem.addRight(stem);
        }
        return absElem;
    }
}
export default TempoElement;
