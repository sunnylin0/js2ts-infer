import SynthSequence from './synth-sequence';
import CreateSynth from './create-synth';
import activeAudioContext from "./active-audio-context";
export default function playEvent(midiPitches, midiGracePitches, millisecondsPerMeasure, soundFontUrl, debugCallback) {
    const sequence = new SynthSequence();
    for (let i = 0; i < midiPitches.length; i++) {
        const note = midiPitches[i];
        const trackNum = sequence.addTrack();
        sequence.setInstrument(trackNum, note.instrument);
        if (i === 0 && midiGracePitches) {
            for (let j = 0; j < midiGracePitches.length; j++) {
                const grace = midiGracePitches[j];
                sequence.appendNote(trackNum, grace.pitch, 1 / 64, grace.volume, grace.cents);
            }
        }
        sequence.appendNote(trackNum, note.pitch, note.duration, note.volume, note.cents);
    }
    const ac = activeAudioContext();
    if (ac && ac.state === "suspended") {
        return ac.resume().then(() => {
            return doPlay(sequence, millisecondsPerMeasure, soundFontUrl, debugCallback);
        });
    }
    else {
        return doPlay(sequence, millisecondsPerMeasure, soundFontUrl, debugCallback);
    }
}
function doPlay(sequence, millisecondsPerMeasure, soundFontUrl, debugCallback) {
    const buffer = new CreateSynth();
    return buffer.init({
        sequence: sequence,
        millisecondsPerMeasure: millisecondsPerMeasure,
        options: { soundFontUrl: soundFontUrl },
        debugCallback: debugCallback,
    }).then(() => {
        return buffer.prime();
    }).then(() => {
        buffer.start();
        return Promise.resolve();
    });
}
