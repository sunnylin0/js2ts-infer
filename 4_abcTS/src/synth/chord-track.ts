export default class ChordTrack {
    lastChord: any;
    chordLastBar: any;
    overridePattern: any;
    chordInstrument: any;
    bassInstrument: any;
    meter: any;
    gChordTacet: any;
    chordsOff: any;
    chordChannel: any;
    chordTrack = [];
    chordTrackFinished = false;
    currentChords = [];
    hasRhythmHead = false;
    transpose = 0;
    lastBarTime = 0;
    tempoChangeFactor = 1;
    bassOctaveShift = 0;
    chordOctaveShift = 0;
    boomVolume = 64;
    chickVolume = 48;
    breakSynonyms = ['break', '(break)', 'no chord', 'n.c.', 'tacet'];
    basses = {
                    'A': 33, 'B': 35, 'C': 36, 'D': 38, 'E': 40, 'F': 41, 'G': 43
                };
    chordIntervals = {
                    'dim': [0, 3, 6], '°': [0, 3, 6], '˚': [0, 3, 6], 'dim7': [0, 3, 6, 9], '°7': [0, 3, 6, 9], '˚7': [0, 3, 6, 9],
                    'ø7': [0, 3, 6, 10], 'm7(b5)': [0, 3, 6, 10], 'm7b5': [0, 3, 6, 10], 'm7♭5': [0, 3, 6, 10], '-7(b5)': [0, 3, 6, 10], '-7b5': [0, 3, 6, 10],
                    '7b5': [0, 4, 6, 10], '7(b5)': [0, 4, 6, 10], '7♭5': [0, 4, 6, 10], '7(b9,b5)': [0, 4, 6, 10, 13], '7b9,b5': [0, 4, 6, 10, 13],
                    '7(#9,b5)': [0, 4, 6, 10, 15], '7#9b5': [0, 4, 6, 10, 15], 'maj7(b5)': [0, 4, 6, 11], 'maj7b5': [0, 4, 6, 11],
                    '13(b5)': [0, 4, 6, 10, 14, 21], '13b5': [0, 4, 6, 10, 14, 21], 'm': [0, 3, 7], '-': [0, 3, 7], 'm6': [0, 3, 7, 9],
                    '-6': [0, 3, 7, 9], 'm7': [0, 3, 7, 10], '-7': [0, 3, 7, 10], '-(b6)': [0, 3, 7, 8], '-b6': [0, 3, 7, 8],
                    '-6/9': [0, 3, 7, 9, 14], '-7(b9)': [0, 3, 7, 10, 13], '-7b9': [0, 3, 7, 10, 13], '-maj7': [0, 3, 7, 11],
                    '-9+7': [0, 3, 7, 11, 13], '-11': [0, 3, 7, 11, 14, 17], 'm11': [0, 3, 7, 11, 14, 17], '-maj9': [0, 3, 7, 11, 14],
                    '-∆9': [0, 3, 7, 11, 14], 'mM9': [0, 3, 7, 11, 14], 'M': [0, 4, 7], '6': [0, 4, 7, 9], '6/9': [0, 4, 7, 9, 14],
                    '6add9': [0, 4, 7, 9, 14], '69': [0, 4, 7, 9, 14], '7': [0, 4, 7, 10], '9': [0, 4, 7, 10, 14], '11': [0, 7, 10, 14, 17],
                    '13': [0, 4, 7, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], '7♭9': [0, 4, 7, 10, 13], '7(b9)': [0, 4, 7, 10, 13],
                    '7(#9)': [0, 4, 7, 10, 15], '7#9': [0, 4, 7, 10, 15], '(13)': [0, 4, 7, 10, 14, 21], '7(9,13)': [0, 4, 7, 10, 14, 21],
                    '7(#9,b13)': [0, 4, 7, 10, 15, 20], '7(#11)': [0, 4, 7, 10, 14, 18], '7#11': [0, 4, 7, 10, 14, 18],
                    '7(b13)': [0, 4, 7, 10, 20], '7b13': [0, 4, 7, 10, 20], '9(#11)': [0, 4, 7, 10, 14, 18], '9#11': [0, 4, 7, 10, 14, 18],
                    '13(#11)': [0, 4, 7, 10, 18, 21], '13#11': [0, 4, 7, 10, 18, 21], 'maj7': [0, 4, 7, 11], '∆7': [0, 4, 7, 11],
                    'Δ7': [0, 4, 7, 11], 'maj9': [0, 4, 7, 11, 14], 'maj7(9)': [0, 4, 7, 11, 14], 'maj7(11)': [0, 4, 7, 11, 17],
                    'maj7(#11)': [0, 4, 7, 11, 18], 'maj7(13)': [0, 4, 7, 14, 21], 'maj7(9,13)': [0, 4, 7, 11, 14, 21],
                    '7sus4': [0, 5, 7, 10], 'm7sus4': [0, 3, 7, 10, 17], 'sus4': [0, 5, 7], 'sus2': [0, 2, 7], '7sus2': [0, 2, 7, 10],
                    '9sus4': [0, 5, 7, 10, 14], '13sus4': [0, 5, 7, 10, 14, 21], 'aug7': [0, 4, 8, 10], '+7': [0, 4, 8, 10],
                    '+': [0, 4, 8], '7#5': [0, 4, 8, 10], '7♯5': [0, 4, 8, 10], '7+5': [0, 4, 8, 10], '9#5': [0, 4, 8, 10, 14],
                    '9♯5': [0, 4, 8, 10, 14], '9+5': [0, 4, 8, 10, 14], '-7(#5)': [0, 3, 8, 10], '-7#5': [0, 3, 8, 10],
                    '7(#5)': [0, 4, 8, 10], '7(b9,#5)': [0, 4, 8, 10, 13], '7b9#5': [0, 4, 8, 10, 13], 'maj7(#5)': [0, 4, 8, 11],
                    'maj7#5': [0, 4, 8, 11], 'maj7(#5,#11)': [0, 4, 8, 11, 18], 'maj7#5#11': [0, 4, 8, 11, 18],
                    '9(#5)': [0, 4, 8, 10, 14], '13(#5)': [0, 4, 8, 10, 14, 21], '13#5': [0, 4, 8, 10, 14, 21], '5': [0, 7],
                    '5(8)': [0, 7, 12], '5add8': [0, 7, 12]
                };
    rhythmPatterns = {
                    "2/2": ['boom', '', '', '', 'chick', '', '', ''],
                    "3/2": ['boom', '', '', '', 'chick', '', '', '', 'chick', '', '', ''],
                    "4/2": ['boom', '', '', '', 'chick', '', '', '', 'boom', '', '', '', 'chick', '', '', ''],
                    "2/4": ['boom', '', 'chick', ''],
                    "3/4": ['boom', '', 'chick', '', 'chick', ''],
                    "4/4": ['boom', '', 'chick', '', 'boom', '', 'chick', ''],
                    "5/4": ['boom', '', 'chick', '', 'chick', '', 'boom', '', 'chick', ''],
                    "6/4": ['boom', '', 'chick', '', 'boom', '', 'chick', '', 'boom', '', 'chick', ''],
                    "3/8": ['boom', '', 'chick'],
                    "5/8": ['boom', 'chick', 'chick', 'boom', 'chick'],
                    "6/8": ['boom', '', 'chick', 'boom', '', 'chick'],
                    "7/8": ['boom', 'chick', 'chick', 'boom', 'chick', 'boom', 'chick'],
                    "9/8": ['boom', '', 'chick', 'boom', '', 'chick', 'boom', '', 'chick'],
                    "10/8": ['boom', 'chick', 'chick', 'boom', 'chick', 'chick', 'boom', 'chick', 'boom', 'chick'],
                    "11/8": ['boom', 'chick', 'chick', 'boom', 'chick', 'chick', 'boom', 'chick', 'boom', 'chick', 'chick'],
                    "12/8": ['boom', '', 'chick', 'boom', '', 'chick', 'boom', '', 'chick', 'boom', '', 'chick'],
                };

    constructor(numVoices, chordsOff, midiOptions, meter) {
        this.chordChannel = numVoices;
        this.chordsOff = !!chordsOff;
        this.gChordTacet = this.chordsOff;
        this.meter = meter;
        this.bassInstrument = midiOptions.bassprog && midiOptions.bassprog.length >= 1 ? midiOptions.bassprog[0] : 0;
        this.chordInstrument = midiOptions.chordprog && midiOptions.chordprog.length >= 1 ? midiOptions.chordprog[0] : 0;
        if (midiOptions.gchord && midiOptions.gchord.length > 0) {
            this.overridePattern = this.parseGChord(midiOptions.gchord[0]);
        }
    }
    setMeter(meter): void { this.meter = meter; }
    setTempoChangeFactor(factor): void { this.tempoChangeFactor = factor; }
    setLastBarTime(time): void { this.lastBarTime = time; }
    setTranspose(transpose): void { this.transpose = transpose; }
    setRhythmHead(isRhythmHead, elem): any[] {
        this.hasRhythmHead = isRhythmHead;
        const ePitches = [];
        if (isRhythmHead && this.lastChord && this.lastChord.chick) {
            for (let i: number = 0; i < this.lastChord.chick.length; i++) {
                const note = Object.assign({}, elem.pitches[0]);
                note.actualPitch = this.lastChord.chick[i];
                ePitches.push(note);
            }
        }
        return ePitches;
    }
    barEnd(element): void {
        if (this.chordTrack.length > 0 && !this.chordTrackFinished) {
            this.resolveChords(this.lastBarTime, this.timeToRealTime(element.time));
            this.currentChords = [];
        }
        this.chordLastBar = this.lastChord;
    }
    gChordOn(element): void {
        if (!this.chordsOff)
            this.gChordTacet = element.tacet;
    }
    paramChange(element): void {
        switch (element.el_type) {
            case "gchord":
                if (element.param && element.param.length > 0) {
                    this.overridePattern = this.parseGChord(element.param);
                }
                else {
                    this.overridePattern = undefined;
                }
                break;
            case "bassprog":
                this.bassInstrument = element.value;
                this.bassOctaveShift = element.octaveShift ?? 0;
                break;
            case "chordprog":
                this.chordInstrument = element.value;
                this.chordOctaveShift = element.octaveShift ?? 0;
                break;
            case "bassvol":
                this.boomVolume = element.param;
                break;
            case "chordvol":
                this.chickVolume = element.param;
                break;
        }
    }
    finish(): void {
        if (!this.chordTrackEmpty())
            this.chordTrackFinished = true;
    }
    addTrack(tracks): void {
        if (!this.chordTrackEmpty())
            tracks.push(this.chordTrack);
    }
    findChord(elem): string {
        if (this.gChordTacet)
            return 'break';
        if (this.chordTrackFinished || !elem.chord || elem.chord.length === 0)
            return null;
        for (let i: number = 0; i < elem.chord.length; i++) {
            const ch = elem.chord[i];
            if (ch.position === 'default')
                return ch.name;
            if (this.breakSynonyms.indexOf(ch.name.toLowerCase()) >= 0)
                return 'break';
        }
        return null;
    }
    interpretChord(name) {
        if (name.length === 0)
            return undefined;
        if (name === 'break')
            return { chick: [] };
        let root = name[0].toUpperCase();
        if (this.basses[root] === undefined)
            return undefined;
        let bass = this.basses[root];
        let i: number = 1;
        if (name[1] === '#' || name[1] === '♯') {
            bass++;
            i++;
        }
        else if (name[1] === 'b' || name[1] === '♭') {
            bass--;
            i++;
        }
        let modifier: string = "";
        let slash = name.indexOf('/', i);
        if (slash >= 0) {
            modifier = name.substring(i, slash);
        }
        else {
            modifier = name.substring(i);
        }
        modifier = modifier.trim();
        if (modifier.length > 0 && modifier[0] === '(' && modifier[modifier.length - 1] === ')') {
            modifier = modifier.substring(1, modifier.length - 1);
        }
        let boom = bass + this.transpose + this.bassOctaveShift * 12;
        let boom2 = boom + 7; // default to fifth
        // TODO-PER: handle bass note after slash
        return { boom, boom2, chick: this.chordNotes(bass + this.transpose, modifier) };
    }
    chordNotes(bass, modifier: string) {
        let intervals = this.chordIntervals[modifier];
        if (!intervals) {
            if (modifier.slice(0, 2).toLowerCase() === 'ma' || modifier[0] === 'M')
                intervals = this.chordIntervals.M;
            else if (modifier[0] === 'm' || modifier[0] === '-')
                intervals = this.chordIntervals.m;
            else
                intervals = this.chordIntervals.M;
        }
        bass += 12 + (this.chordOctaveShift * 12);
        return intervals.map(inter => bass + inter);
    }
    writeNoteCustom(pitch, beatLength: number, volume: number, beat: number, noteLength: number, instrument): void {
        if (pitch !== undefined) {
            this.chordTrack.push({
                cmd: 'note',
                pitch: pitch,
                volume: volume,
                start: this.lastBarTime + beat * this.durationRounded(beatLength),
                duration: this.durationRounded(noteLength),
                gap: 0,
                instrument: instrument
            });
        }
    }
    chordTrackEmpty(): boolean {
        return !this.chordTrack.some(event => event.cmd === 'note');
    }
    resolveChords(startTime: number, endTime: number): void {
        if (this.hasRhythmHead)
            return;
        const num = this.meter.num;
        const den = this.meter.den;
        const beatLength: number = 1 / den;
        const noteLength: number = beatLength / 2;
        const thisMeasureLength: number = parseInt(num, 10) / parseInt(den, 10);
        let portionOfAMeasure: number = thisMeasureLength - (endTime - startTime) / this.tempoChangeFactor;
        if (Math.abs(portionOfAMeasure) < 0.00001)
            portionOfAMeasure = 0;
        if (this.currentChords.length === 0 || this.currentChords[0].beat !== 0) {
            this.currentChords.unshift({ beat: 0, chord: this.chordLastBar });
        }
        const currentChordsExpanded: any[] = this.expandCurrentChords(this.currentChords, 8 * num / den, beatLength);
        let thisPattern = this.overridePattern ? this.overridePattern : this.rhythmPatterns[num + '/' + den];
        if (portionOfAMeasure) {
            thisPattern = [];
            const beatsPresent: number = ((endTime - startTime) / this.tempoChangeFactor) * 8;
            for (let p: number = 0; p < beatsPresent / 2; p++) {
                thisPattern.push("chick");
                thisPattern.push("");
            }
        }
        if (!thisPattern) {
            thisPattern = [];
            for (let p: number = 0; p < (8 * num / den) / 2; p++) {
                thisPattern.push('chick');
                thisPattern.push("");
            }
        }
        let firstBoom: boolean = true;
        const minLength: number = Math.min(thisPattern.length, currentChordsExpanded.length);
        for (let p: number = 0; p < minLength; p++) {
            if (p > 0 && currentChordsExpanded[p - 1] && currentChordsExpanded[p] && currentChordsExpanded[p - 1].boom !== currentChordsExpanded[p].boom)
                firstBoom = true;
            const type = thisPattern[p];
            let isBoom: boolean = type.indexOf('boom') >= 0;
            let newBass: boolean = !isBoom && p !== 0 && thisPattern[0].indexOf('boom') >= 0 &&
                (!currentChordsExpanded[p - 1] || currentChordsExpanded[p - 1].boom !== currentChordsExpanded[p].boom);
            const pitches: any[] = this.resolvePitch(currentChordsExpanded[p], type, firstBoom, newBass);
            if (isBoom)
                firstBoom = false;
            for (let oo: number = 0; oo < pitches.length; oo++) {
                this.writeNoteCustom(pitches[oo], 0.125, isBoom || newBass ? this.boomVolume : this.chickVolume, p, noteLength, isBoom || newBass ? this.bassInstrument : this.chordInstrument);
                if (newBass)
                    newBass = false;
                else
                    isBoom = false;
            }
        }
    }
    processChord(elem): void {
        if (this.chordTrackFinished)
            return;
        const chord = this.findChord(elem);
        if (chord) {
            const c = this.interpretChord(chord);
            if (c) {
                if (this.chordTrack.length === 0) {
                    this.chordTrack.push({ cmd: 'program', channel: this.chordChannel, instrument: this.chordInstrument });
                }
                this.lastChord = c;
                const barBeat: number = this.calcBeat(this.lastBarTime, this.timeToRealTime(elem.time));
                this.currentChords.push({ chord: this.lastChord, beat: barBeat, start: this.timeToRealTime(elem.time) });
            }
        }
    }
    resolvePitch(currentChord, type, firstBoom: boolean, newBass: boolean): any[] {
        const ret = [];
        if (!currentChord)
            return ret;
        if (type.indexOf('boom') >= 0)
            ret.push(firstBoom ? currentChord.boom : currentChord.boom2);
        else if (newBass)
            ret.push(currentChord.boom);
        if (type.indexOf('chick') >= 0) {
            for (let i: number = 0; i < currentChord.chick.length; i++)
                ret.push(currentChord.chick[i]);
        }
        switch (type) {
            case 'DO':
                ret.push(currentChord.chick[0]);
                break;
            case 'MI':
                ret.push(currentChord.chick[1]);
                break;
            case 'SOL':
                ret.push(this.extractNote(currentChord, 2));
                break;
            case 'TI':
                ret.push(this.extractNote(currentChord, 3));
                break;
            case 'TOP':
                ret.push(this.extractNote(currentChord, 4));
                break;
            case 'do':
                ret.push(currentChord.chick[0] + 12);
                break;
            case 'mi':
                ret.push(currentChord.chick[1] + 12);
                break;
            case 'sol':
                ret.push(this.extractNote(currentChord, 2) + 12);
                break;
            case 'ti':
                ret.push(this.extractNote(currentChord, 3) + 12);
                break;
            case 'top':
                ret.push(this.extractNote(currentChord, 4) + 12);
                break;
        }
        return ret;
    }
    extractNote(chord, index: number) {
        const octave: number = Math.floor(index / chord.chick.length);
        const note = chord.chick[index % chord.chick.length];
        return note + octave * 12;
    }
    parseGChord(gchord): any[] {
        const pattern = [];
        for (let i: number = 0; i < gchord.length; i++) {
            const ch = gchord[i];
            switch (ch) {
                case 'z':
                case '2':
                    pattern.push('');
                    break;
                case 'c':
                    pattern.push('chick');
                    break;
                case 'b':
                    pattern.push('boom&chick');
                    break;
                case 'f':
                    pattern.push('boom');
                    break;
                case 'G':
                    pattern.push('DO');
                    break;
                case 'H':
                    pattern.push('MI');
                    break;
                case 'I':
                    pattern.push('SOL');
                    break;
                case 'J':
                    pattern.push('TI');
                    break;
                case 'K':
                    pattern.push('TOP');
                    break;
                case 'g':
                    pattern.push('do');
                    break;
                case 'h':
                    pattern.push('mi');
                    break;
                case 'i':
                    pattern.push('sol');
                    break;
                case 'j':
                    pattern.push('ti');
                    break;
                case 'k':
                    pattern.push('top');
                    break;
            }
        }
        return pattern;
    }
    expandCurrentChords(currentChords: any[], num8thNotes: number, beatLength: number): any[] {
        const chords = [];
        if (currentChords.length === 0)
            return chords;
        let currentChord = currentChords[0].chord;
        for (let i: number = 1; i < currentChords.length; i++) {
            const current = currentChords[i];
            while (chords.length < current.beat)
                chords.push(currentChord);
            currentChord = current.chord;
        }
        while (chords.length < num8thNotes)
            chords.push(currentChord);
        return chords;
    }
    calcBeat(measureStart: number, currTime: number): number {
        return (currTime - measureStart) * 8;
    }
    timeToRealTime(time): number { return time / 1000000; }
    durationRounded(duration: number): number { return Math.round(duration * this.tempoChangeFactor * 1000000) / 1000000; }
}
