const accidentals = {
    "__": -2,
    "_": -1,
    "_/": -0.5,
    "=": 0,
    "": 0,
    "^/": 0.5,
    "^": 1,
    "^^": 2
};
const notesInOrder: Array<string> = ['C', '-', 'D', '-', 'E', 'F', '-', 'G', '-', 'A', '-', 'B', 'c', '-', 'd', '-', 'e', 'f', '-', 'g', '-', 'a', '-', 'b'];
export function noteToMidi(note): number {
    const reg = note.match(/([_^\/]*)([ABCDEFGabcdefg])(,*)('*)/);
    if (reg && reg.length === 5) {
        const acc = accidentals[reg[1]] || 0;
        const pitch: number = notesInOrder.indexOf(reg[2]);
        const octave: number = reg[4].length - reg[3].length;
        return 48 + pitch + acc + octave * 12;
    }
    return 0;
}
export function midiToNote(midi: number): string {
    let midiNum: number = typeof midi === 'string' ? parseInt(midi, 10) : midi;
    const octaveVal: number = Math.floor(midiNum / 12);
    const pitch: number = midiNum % 12;
    let name: string = notesInOrder[pitch];
    let octave: number = octaveVal;
    if (name === '-') {
        name = '^' + notesInOrder[pitch - 1];
    }
    if (octave > 4) {
        name = name.toLowerCase();
        octave -= 5;
        while (octave > 0) {
            name += "'";
            octave--;
        }
    }
    else {
        while (octave < 4) {
            name += ',';
            octave++;
        }
    }
    return name;
}
