export default class SynthSequence {
	public tracks: any[][] = [];
	public totalDuration: number = 0;
	public currentInstrument: number[] = [];
	public starts: number[] = [];

	public addTrack(): number {
		this.tracks.push([]);
		this.currentInstrument.push(0);
		this.starts.push(0);
		return this.tracks.length - 1;
	}

	public setInstrument(trackNumber: number, instrumentNumber: number): void {
		this.tracks[trackNumber].push({
			channel: 0,
			cmd: "program",
			instrument: instrumentNumber
		});
		this.currentInstrument[trackNumber] = instrumentNumber;
	}

	public appendNote(trackNumber: number, pitch: number, durationInMeasures: number, volume: number, cents?: number): void {
		const note: any = {
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
