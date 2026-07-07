import TabNote from './tab-note';
const notesList: Array<string> = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export default function tabNotes(fromNote, toNote): any[] {
    const fromN: TabNote = new TabNote(fromNote);
    const toN: TabNote = new TabNote(toNote);
    // check that toN is not lower than fromN
    if (toN.isLowerThan(fromN)) {
        const from: string = fromN.emit();
        const tn: string = toN.emit();
        return {
            error: `Invalid string Instrument tuning : ${tn} string lower than ${from} string`
        };
    }
    const buildReturned = [];
    const startIndex: number = notesList.indexOf(fromN.name);
    const toIndex: number = notesList.indexOf(toN.name);
    if ((startIndex === -1) || (toIndex === -1)) {
        return buildReturned;
    }
    let currentN: TabNote = fromN;
    let finished: boolean = false;
    while (!finished) {
        buildReturned.push(currentN.emit());
        currentN = currentN.nextNote();
        if (currentN.sameNoteAs(toN)) {
            finished = true;
        }
    }
    return buildReturned;
}
