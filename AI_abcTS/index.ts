import version from './version';
import animation from './src/api/abc_animation';
import tuneBook from './src/api/abc_tunebook';
import sequence from './src/synth/abc_midi_sequencer';
import strTranspose from './src/str/output';
import renderAbc from './src/api/abc_tunebook_svg';
import tuneMetrics from './src/api/tune-metrics';
import TimingCallbacks from './src/api/abc_timing_callbacks';
import glyphs from './src/write/creation/glyphs';

import CreateSynth from './src/synth/create-synth';
import instrumentIndexToName from './src/synth/instrument-index-to-name';
import pitchToNoteName from './src/synth/pitch-to-note-name';
import SynthSequence from './src/synth/synth-sequence';
import CreateSynthControl from './src/synth/create-synth-control';
import registerAudioContext from './src/synth/register-audio-context';
import activeAudioContext from './src/synth/active-audio-context';
import supportsAudio from './src/synth/supports-audio';
import playEvent from './src/synth/play-event';
import SynthController from './src/synth/synth-controller';
import getMidiFile from './src/synth/get-midi-file';
import midiRenderer from './src/synth/abc_midi_renderer';

import abcTablatures from './src/tablatures/abc_tablatures';
import Editor from './src/edit/abc_editor';
import EditArea from './src/edit/abc_editarea';

const abcjs: any = {
	signature: "abcjs-basic v" + version,
};

// Flatten animation and tuneBook into abcjs
Object.assign(abcjs, animation);
Object.assign(abcjs, tuneBook);

abcjs.renderAbc = renderAbc;
abcjs.tuneMetrics = tuneMetrics;
abcjs.TimingCallbacks = TimingCallbacks;
abcjs.setGlyph = glyphs.setSymbol;
abcjs.strTranspose = strTranspose;

abcjs.synth = {
	CreateSynth,
	instrumentIndexToName,
	pitchToNoteName,
	SynthController,
	SynthSequence,
	CreateSynthControl,
	registerAudioContext,
	activeAudioContext,
	supportsAudio,
	playEvent,
	getMidiFile,
	sequence,
	midiRenderer,
};

abcjs.tablatures = abcTablatures;
abcjs.Editor = Editor;
abcjs.EditArea = EditArea;

// Standard exports for modern JS environments
export {
	version,
	animation,
	tuneBook,
	renderAbc,
	tuneMetrics,
	TimingCallbacks,
	strTranspose,
	CreateSynth,
	SynthController,
	SynthSequence,
	CreateSynthControl,
	Editor,
	EditArea,
	abcTablatures
};

export default abcjs;
