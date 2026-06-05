const allPitches: string[] = [
	'C,,,', 'D,,,', 'E,,,', 'F,,,', 'G,,,', 'A,,,', 'B,,,',
	'C,,', 'D,,', 'E,,', 'F,,', 'G,,', 'A,,', 'B,,',
	'C,', 'D,', 'E,', 'F,', 'G,', 'A,', 'B,',
	'C', 'D', 'E', 'F', 'G', 'A', 'B',
	'c', 'd', 'e', 'f', 'g', 'a', 'b',
	"c'", "d'", "e'", "f'", "g'", "a'", "b'",
	"c''", "d''", "e''", "f''", "g''", "a''", "b''",
	"c'''", "d'''", "e'''", "f'''", "g'''", "a'''", "b'''",
];

const allNotes = {
	pitchIndex: function (noteName: string): number {
		return allPitches.indexOf(noteName);
	},

	noteName: function (pitchIndex: number): string | undefined {
		return allPitches[pitchIndex];
	}
};

export default allNotes;
