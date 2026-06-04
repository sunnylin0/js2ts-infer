import AbsoluteElement from './absolute-element';
import RelativeElement from './relative-element';
class TempoElement {
    constructor(tempo, tuneNumber, createNoteHead) {
        this.type = "TempoElement";
        this.totalHeightInPitches = 6;
        this.tempoHeightAbove = 6;
        this.x = 0;
        this.tempo = tempo;
        this.tempo.type = "tempo";
        this.tuneNumber = tuneNumber;
        this.totalHeightInPitches = 6;
        this.tempoHeightAbove = this.totalHeightInPitches;
        this.pitch = undefined;
        if (this.tempo.duration && !this.tempo.suppressBpm) {
            this.note = this.createNote(createNoteHead, tempo, tuneNumber);
        }
    }
    setX(x) {
        this.x = x;
    }
    createNote(createNoteHead, tempo, tuneNumber) {
        const temposcale = 0.75;
        const duration = tempo.duration[0];
        const absElem = new AbsoluteElement(tempo, duration, 1, 'tempo', tuneNumber);
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
        const tempoNote = ret.notehead;
        absElem.addHead(tempoNote);
        if (note !== "noteheads.whole" && note !== "noteheads.dbl") {
            const p1 = 1 / 3 * temposcale;
            const p2 = 5 * temposcale;
            const dx = tempoNote.dx + tempoNote.w;
            const width = -0.6;
            const stem = new RelativeElement(null, dx, 0, p1, { "type": "stem", "pitch2": p2, linewidth: width });
            absElem.addRight(stem);
        }
        return absElem;
    }
}
export default TempoElement;
