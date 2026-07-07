const sharpChords: Array<string> = ['C', 'C♯', 'D', "D♯", 'E', 'F', "F♯", 'G', 'G♯', 'A', 'A♯', 'B'];
const flatChords: Array<string> = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const sharpChordsFree: Array<string> = ['C', 'C#', 'D', "D#", 'E', 'F', "F#", 'G', 'G#', 'A', 'A#', 'B'];
const flatChordsFree: Array<string> = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
function transposeChordName(chord: string, steps: number, preferFlats: boolean, freeGCchord: boolean): string {
    if (!steps || (steps % 12 === 0)) // The chords are the same if it is an exact octave change.
        return chord;
    while (steps < 0)
        steps += 12;
    if (steps > 11)
        steps = steps % 12;
    // (chord name w/accidental) (a bunch of stuff) (/) (bass note) (anything else)
    const match: RegExpMatchArray = chord.match(/^([A-G][b#♭♯]?)([^\/]+)?\/?([A-G][b#♭♯]?)?(.+)?/);
    if (!match)
        return chord; // We don't recognize the format of the chord, so skip it.
    const name = match[1];
    const extra1 = match[2];
    const bass = match[3];
    const extra2 = match[4];
    let index: number = sharpChords.indexOf(name);
    if (index < 0)
        index = flatChords.indexOf(name);
    if (index < 0)
        index = sharpChordsFree.indexOf(name);
    if (index < 0)
        index = flatChordsFree.indexOf(name);
    if (index < 0)
        return chord; // This should never happen, but if we can't find the chord just bail.	
    index += steps;
    index = index % 12;
    if (preferFlats) {
        if (freeGCchord)
            chord = flatChordsFree[index];
        else
            chord = flatChords[index];
    }
    else {
        if (freeGCchord)
            chord = sharpChordsFree[index];
        else
            chord = sharpChords[index];
    }
    const isDim: boolean = extra1 && (extra1.indexOf('dim') >= 0 || extra1.indexOf('°') >= 0);
    if (isDim && chord === 'A#')
        chord = 'Bb';
    if (isDim && chord === 'D#')
        chord = 'Eb';
    if (isDim && chord === 'A♯')
        chord = 'B♭';
    if (isDim && chord === 'D♯')
        chord = 'E♭';
    if (extra1)
        chord += extra1;
    if (bass) {
        let bassIndex: number = sharpChords.indexOf(bass);
        if (bassIndex < 0)
            bassIndex = flatChords.indexOf(bass);
        if (bassIndex < 0)
            bassIndex = sharpChordsFree.indexOf(bass);
        if (bassIndex < 0)
            bassIndex = flatChordsFree.indexOf(bass);
        chord += '/';
        if (bassIndex >= 0) {
            bassIndex += steps;
            bassIndex = bassIndex % 12;
            if (preferFlats) {
                if (freeGCchord)
                    chord += flatChordsFree[bassIndex];
                else
                    chord += flatChords[bassIndex];
            }
            else {
                if (freeGCchord)
                    chord += sharpChordsFree[bassIndex];
                else
                    chord += sharpChords[bassIndex];
            }
        }
        else {
            chord += bass; // Don't know what to do so do nothing
        }
    }
    if (extra2)
        chord += extra2;
    return chord;
}
export default transposeChordName;
