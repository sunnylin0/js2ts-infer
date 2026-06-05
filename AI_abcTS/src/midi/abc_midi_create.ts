import rendererFactory from '../synth/abc_midi_renderer';

const baseDuration = 480 * 4; // nice and divisible, equals 1 whole note

interface NoteEvent {
	pitch: number;
	volume: number;
	cents?: number;
}

export default function create(abcTune: any, options: any = {}): string {
	const commands = abcTune.setUpAudio(options);
	const midi = rendererFactory();
	let title = abcTune.metaText ? abcTune.metaText.title : undefined;
	if (title && title.length > 128) title = title.substring(0, 124) + '...';
	const key = abcTune.getKeySignature();
	const time = abcTune.getMeterFraction();

	let tempo = commands.tempo;
	let beatsPerSecond = tempo / 60;

	// Fix tempo for compound meters
	if (time.den === 8 && time.num !== 5 && time.num !== 7) {
		const msPerMeasure = abcTune.millisecondsPerMeasure();
		tempo = (60000 / (msPerMeasure / time.num)) / 2;
		beatsPerSecond = tempo / 60;
	}

	midi.setGlobalInfo(tempo, title, key, time);

	for (let i = 0; i < commands.tracks.length; i++) {
		midi.startTrack();
		const notePlacement: Record<number, NoteEvent[]> = {};
		for (let j = 0; j < commands.tracks[i].length; j++) {
			const event = commands.tracks[i][j];
			switch (event.cmd) {
				case 'text':
					midi.setText(event.type, event.text);
					break;
				case 'program':
					let pan = 0;
					if (options.pan && options.pan.length > i)
						pan = options.pan[i];
					if (event.instrument === 128) {
						midi.setChannel(9, pan);
						midi.setInstrument(0);
					} else {
						midi.setChannel(event.channel, pan);
						midi.setInstrument(event.instrument);
					}
					break;
				case 'note':
					const gapLengthInBeats = event.gap * beatsPerSecond;
					const start = event.start;
					const end = start + event.duration - gapLengthInBeats;
					if (!notePlacement[start])
						notePlacement[start] = [];
					notePlacement[start].push({ pitch: event.pitch, volume: event.volume, cents: event.cents });
					if (!notePlacement[end])
						notePlacement[end] = [];
					notePlacement[end].push({ pitch: event.pitch, volume: 0 });
					break;
				default:
					console.log("MIDI create Unknown: " + event.cmd);
			}
		}
		addNotes(midi, notePlacement, baseDuration);
		midi.endTrack();
	}

	return midi.getData();
}

function addNotes(midi: any, notePlacement: Record<number, NoteEvent[]>, baseDuration: number): void {
	const times = Object.keys(notePlacement).map(t => parseFloat(t));
	times.sort((a, b) => a - b);
	
	let lastTime = 0;
	for (let i = 0; i < times.length; i++) {
		const events = notePlacement[times[i]];
		if (times[i] > lastTime) {
			const distance = (times[i] - lastTime) * baseDuration;
			midi.addRest(distance);
			lastTime = times[i];
		}
		for (let j = 0; j < events.length; j++) {
			const event = events[j];
			if (event.volume) {
				midi.startNote(event.pitch, event.volume, event.cents);
			} else {
				midi.endNote(event.pitch);
			}
		}
	}
}
