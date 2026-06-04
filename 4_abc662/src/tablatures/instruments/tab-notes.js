import TabNote from './tab-note';
const notesList = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export default function tabNotes(fromNote, toNote) {
    const fromN = new TabNote(fromNote);
    const toN = new TabNote(toNote);
    // check that toN is not lower than fromN
    if (toN.isLowerThan(fromN)) {
        const from = fromN.emit();
        const tn = toN.emit();
        return {
            error: `Invalid string Instrument tuning : ${tn} string lower than ${from} string`
        };
    }
    const buildReturned = [];
    const startIndex = notesList.indexOf(fromN.name);
    const toIndex = notesList.indexOf(toN.name);
    if ((startIndex === -1) || (toIndex === -1)) {
        return buildReturned;
    }
    let currentN = fromN;
    let finished = false;
    while (!finished) {
        buildReturned.push(currentN.emit());
        currentN = currentN.nextNote();
        if (currentN.sameNoteAs(toN)) {
            finished = true;
        }
    }
    return buildReturned;
}
