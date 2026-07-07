import allNotes from "./all-notes";
import transposeChordName from "../parse/transpose-chord";
import keyAccidentals from '../const/key-accidentals';
const transpose: {} = {};
const keyIndex = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
    'A#': 10, 'Bb': 10, 'B': 11
};
const newKey: Array<string> = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const newKeyMinor: Array<string> = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
transpose.keySignature = function (multilineVars, keyName, root, acc, localTranspose) {
    if (multilineVars.clef.type === "perc" || multilineVars.clef.type === "none")
        return { accidentals: keyAccidentals(keyName), root: root, acc: acc };
    if (!localTranspose)
        localTranspose = 0;
    multilineVars.localTransposeVerticalMovement = 0;
    multilineVars.localTransposePreferFlats = false;
    const k = keyAccidentals(keyName);
    if (!k)
        return multilineVars.key; // If the key isn't in the list, it is non-standard. We won't attempt to transpose it.
    multilineVars.localTranspose = (multilineVars.globalTranspose ? multilineVars.globalTranspose : 0) + localTranspose;
    if (!multilineVars.localTranspose)
        return { accidentals: k, root: root, acc: acc };
    multilineVars.globalTransposeOrigKeySig = k;
    if (multilineVars.localTranspose % 12 === 0) {
        multilineVars.localTransposeVerticalMovement = (multilineVars.localTranspose / 12) * 7;
        return { accidentals: k, root: root, acc: acc };
    }
    let baseKey = keyName[0];
    if (keyName[1] === 'b' || keyName[1] === '#') {
        baseKey += keyName[1];
        keyName = keyName.substr(2);
    }
    else {
        keyName = keyName.substr(1);
    }
    let thisKeyIndex = keyIndex[baseKey];
    const recognized: boolean = thisKeyIndex !== undefined;
    if (!recognized) {
        thisKeyIndex = 0;
        baseKey = "C";
        keyName = "";
    }
    let index = thisKeyIndex + multilineVars.localTranspose;
    while (index < 0)
        index += 12;
    if (index > 11)
        index = index % 12;
    const newKeyName: string = (keyName[0] === 'm' ? newKeyMinor[index] : newKey[index]);
    const transposedKey: string = newKeyName + keyName;
    const newKeySig = keyAccidentals(transposedKey);
    if (newKeySig.length === 0 || (newKeySig[0] && newKeySig[0].acc === 'flat'))
        multilineVars.localTransposePreferFlats = true;
    let distance: number = transposedKey.charCodeAt(0) - baseKey.charCodeAt(0);
    if (multilineVars.localTranspose > 0) {
        if (distance < 0)
            distance += 7;
        else if (distance === 0) {
            if (baseKey[1] === '#' || transposedKey[1] === 'b')
                distance += 7;
        }
    }
    else if (multilineVars.localTranspose < 0) {
        if (distance > 0)
            distance -= 7;
        else if (distance === 0) {
            if (baseKey[1] === 'b' || transposedKey[1] === '#')
                distance -= 7;
        }
    }
    if (multilineVars.localTranspose > 0)
        multilineVars.localTransposeVerticalMovement = distance + Math.floor(multilineVars.localTranspose / 12) * 7;
    else
        multilineVars.localTransposeVerticalMovement = distance + Math.ceil(multilineVars.localTranspose / 12) * 7;
    if (recognized)
        return { accidentals: newKeySig, root: newKeyName[0], acc: newKeyName.length > 1 ? newKeyName[1] : "" };
    else
        return { accidentals: [], root: root, acc: acc };
};
transpose.chordName = function (multilineVars, chord) {
    return transposeChordName(chord, multilineVars.localTranspose, multilineVars.localTransposePreferFlats, multilineVars.freegchord);
};
const pitchToLetter: Array<string> = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
function accidentalChange(origPitch, newPitch, accidental, origKeySig, newKeySig): any[] {
    const origPitchLetter: string = pitchToLetter[(origPitch + 49) % 7];
    let origAccidental: number = 0;
    for (let i: number = 0; i < origKeySig.length; i++) {
        if (origKeySig[i].note.toLowerCase() === origPitchLetter)
            origAccidental = accidentals[origKeySig[i].acc];
    }
    const currentAccidental = accidentals[accidental];
    const delta: number = currentAccidental - origAccidental;
    const newPitchLetter: string = pitchToLetter[(newPitch + 49) % 7];
    let newAccidental: number = 0;
    for (let j: number = 0; j < newKeySig.accidentals.length; j++) {
        if (newKeySig.accidentals[j].note.toLowerCase() === newPitchLetter)
            newAccidental = accidentals[newKeySig.accidentals[j].acc];
    }
    let calcAccidental: number = delta + newAccidental;
    if (calcAccidental < -2) {
        newPitch--;
        calcAccidental += (newPitchLetter === 'c' || newPitchLetter === 'f') ? 1 : 2;
    }
    if (calcAccidental > 2) {
        newPitch++;
        calcAccidental -= (newPitchLetter === 'b' || newPitchLetter === 'e') ? 1 : 2;
    }
    return [newPitch, calcAccidental];
}
const accidentals = {
    dblflat: -2,
    flat: -1,
    natural: 0,
    sharp: 1,
    dblsharp: 2
};
const accidentals2 = {
    "-2": "dblflat",
    "-1": "flat",
    "0": "natural",
    "1": "sharp",
    "2": "dblsharp"
};
const accidentals3 = {
    "-2": "__",
    "-1": "_",
    "0": "=",
    "1": "^",
    "2": "^^"
};
transpose.note = function (multilineVars, el) {
    if (!multilineVars.localTranspose || multilineVars.clef.type === "perc")
        return;
    const origPitch = el.pitch;
    if (multilineVars.localTransposeVerticalMovement) {
        el.pitch = el.pitch + multilineVars.localTransposeVerticalMovement;
        if (el.name) {
            const actual = el.accidental ? el.name.substring(1) : el.name;
            const acc = el.accidental ? el.name[0] : '';
            const p: number = allNotes.pitchIndex(actual);
            el.name = acc + allNotes.noteName(p + multilineVars.localTransposeVerticalMovement);
        }
    }
    if (el.accidental) {
        const ret: any[] = accidentalChange(origPitch, el.pitch, el.accidental, multilineVars.globalTransposeOrigKeySig, multilineVars.targetKey);
        el.pitch = ret[0];
        el.accidental = accidentals2[ret[1].toString()];
        if (el.name) {
            el.name = accidentals3[ret[1].toString()] + el.name.replace(/[_^=]/g, '');
        }
    }
};
export default transpose;
