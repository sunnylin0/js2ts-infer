function germanNote(note: string): string {
    switch (note) {
        case "B#": return "H#";
        case "B♯": return "H♯";
        case "B": return "H";
        case "Bb": return "B";
        case "B♭": return "B";
    }
    return note;
}
function translateChord(chordString: string, jazzchords: boolean, germanAlphabet: boolean): string {
    const lines: Array<string> = chordString.split("\n");
    for (let i: number = 0; i < lines.length; i++) {
        const chord: string = lines[i];
        // If the chord isn't in a recognizable format then just skip it.
        const reg: Array<string | undefined> = chord.match(/^([ABCDEFG][♯♭]?)?([^\/]+)?(\/([ABCDEFG][#b♯♭]?))?/);
        if (!reg) {
            continue;
        }
        let baseChord: string = reg[1] || "";
        const modifier: string = reg[2] || "";
        let bassNote: string = reg[4] || "";
        if (germanAlphabet) {
            baseChord = germanNote(baseChord);
            bassNote = germanNote(bassNote);
        }
        // This puts markers in the pieces of the chord that are read by the svg creator.
        // After the main part of the chord (the letter, a sharp or flat, and "m") a marker is added. Before a slash a marker is added.
        const marker: string = jazzchords ? "\x03" : "";
        const bass: string = bassNote ? "/" + bassNote : "";
        lines[i] = [baseChord, modifier, bass].join(marker);
    }
    return lines.join("\n");
}
export default translateChord;
