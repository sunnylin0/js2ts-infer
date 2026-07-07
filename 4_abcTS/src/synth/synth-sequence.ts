export default class SynthSequence {
    tracks = [];
    totalDuration = 0;
    currentInstrument = [];
    starts = [];

    constructor() {
    }
    addTrack(): number {
        this.tracks.push([]);
        this.currentInstrument.push(0);
        this.starts.push(0);
        return this.tracks.length - 1;
    }
    setInstrument(trackNumber: number, instrumentNumber): void {
        this.tracks[trackNumber].push({
            channel: 0,
            cmd: "program",
            instrument: instrumentNumber
        });
        this.currentInstrument[trackNumber] = instrumentNumber;
    }
    appendNote(trackNumber: number, pitch, durationInMeasures: number, volume, cents): void {
        const note = {
            cmd: "note",
            duration: durationInMeasures,
            gap: 0,
            instrument: this.currentInstrument[trackNumber],
            pitch: pitch,
            start: this.starts[trackNumber],
            volume: volume
        };
        if (cents)
            note.cents = cents;
        this.tracks[trackNumber].push(note);
        this.starts[trackNumber] += durationInMeasures;
        this.totalDuration = Math.max(this.totalDuration, this.starts[trackNumber]);
    }
}
