export default class SynthSequence {
    constructor() {
        this.tracks = [];
        this.totalDuration = 0;
        this.currentInstrument = [];
        this.starts = [];
    }
    addTrack() {
        this.tracks.push([]);
        this.currentInstrument.push(0);
        this.starts.push(0);
        return this.tracks.length - 1;
    }
    setInstrument(trackNumber, instrumentNumber) {
        this.tracks[trackNumber].push({
            channel: 0,
            cmd: "program",
            instrument: instrumentNumber
        });
        this.currentInstrument[trackNumber] = instrumentNumber;
    }
    appendNote(trackNumber, pitch, durationInMeasures, volume, cents) {
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
