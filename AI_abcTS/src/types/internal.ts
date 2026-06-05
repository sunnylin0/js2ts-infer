import { TuneObject, VoiceItemNote, VoiceItemBar } from 'abcjs';

/**
 * These interfaces represent the internal data structures of abcjs
 * that are not necessarily part of the public high-level API but
 * are frequently accessed in the test suite and internal modules.
 */

export interface InternalPitch {
	pitch: number;
	name: string;
	verticalPos: number;
	accidental?: string;
	startChar?: number;
	endChar?: number;
}

export interface InternalVoiceItemNote extends VoiceItemNote {
	pitches: InternalPitch[];
	duration: number;
	el_type: 'note';
	warnings?: string[];
}

export interface InternalVoiceItemBar extends VoiceItemBar {
	el_type: 'bar';
	type: any; // bar type string
}

export type InternalVoiceItem = InternalVoiceItemNote | InternalVoiceItemBar | any;

export interface InternalStaff {
	clef?: any;
	key?: any;
	voices: InternalVoiceItem[][];
}

export interface InternalLine {
	staff: InternalStaff[];
	columns?: any;
}

export interface InternalTuneObject extends TuneObject {
	lines: InternalLine[];
	warnings?: string[];
}
