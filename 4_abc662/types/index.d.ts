
interface Tune {
	formatting: Formatting;
	lines: Lines[];
	media: string;
	metaText: MetaText;
	metaTextInfo: MetaTextInfo;
	version: string;
	meter: MeterValue;
	topText: TopText;
	bottomText: BottomText;
	engraver: EngraverController;

	reset(): void;
	copy(dest: any, src: any, prop: any, attrs: any): void;
	copyTopInfo(src: any): void;
	copyBottomInfo(src: any): void;
	getBeatLength(): number;
	computePickupLength(lines: Lines[], barLength: number): number;
	getPickupLength(): number;
	getBarLength(): number;
	getTotalTime(): number;
	getTotalBeats(): number;
	millisecondsPerMeasure(bpmOverride: number): number;
	getBeatsPerMeasure(): number;
	getMeter(): Meter;
	getMeterFraction(): MeterValue;
	getKeySignature(): KeySignature;
	// getElementFromChar(char: any): Voice;
	// addVerticalInfo(timingEvents: any): void;
	// makeSortedArray(hash: any): any[];
	//addElementToEvents();
	//makeVoicesArray(): never[][];
	//setupEvents(startingDelay: any, timeDivider: any, bpm: any, warp: any): any[];
	//addUsefulCallbackInfo(timingEvents: any, bpm: any): void;
	//skipTies(elements: any, index: any): any;
	//addEndPoints(lines: any, elements: any): void;
	//getBpm(tempo: any): number;
	//setTiming(bpm: any, measuresOfDelay: any): any[];
	noteTimings: any[];
	totalTime: number;
	totalBeats: number;
	// setUpAudio(options: any): {
	// 	tempo: any;
	// 	instrument: any;
	// 	tracks: any[];
	// 	totalDuration: number;
	// };
	//deline(options: any): {staff: any[];}[];
	//findSelectableElement(target: any): any;
	//getSelectableArray(): any;


}

/** @class EngraverController */
interface EngraverController {
	findSelectableElement?: Function;
	dragging: boolean;
	space: number;
	expandToWidest: boolean;
	classes?: Classes;
	staffwidthScreen: number;
	staffwidthPrint: number;
	listeners: any[];
	renderer: Renderer;
	selected: any[];
	staffgroups: StaffGroupElement[];
	engraver: AbstractEngraver;
	dragTarget?: any;
	dragIndex: number;
	dragMouseStart: DragMouseStart;
	dragYStep: number;
	getFontAndAttr?: GetFontAndAttr;
	getTextSize?: GetTextSize;
	width: number;
	selectables: Selectables[];
	svgs: SVGSVGElement[];
	rangeHighlight?: Function;

	constructor(paper: HTMLDivElement, params: any);
	reset(): void;
	engraveABC(abctunes: Tune, tuneNumber: number, lineOffset: number): void;

	adjustNonScaledItems(scale: number): void;
	getMeasureWidths(abcTune: Tune): {
		left: number;
		measureWidths: never[];
		total: number;
	}[];
	setupTune(abcTune: Tune, tuneNumber: number): number;
	constructTuneElements(abcTune: Tune): void;
	engraveTune(abcTune: Tune, tuneNumber: number, lineOffset: number): void;
	getDim(historyEl: any): any;
	addSelectListener(clickListener: any): void;

}

interface Selectables {
	absEl: AbsoluteElement;
	svgEl: SVGGElement;
	isDraggable: boolean;
	staffPos: StaffPos;
}

interface StaffPos {
	top: number;
	zero: number;
	height: number;
}

interface DragMouseStart {
	x: number;
	y: number;
}

/** @class AbstractEngraver */
interface AbstractEngraver {
	decoration: Decoration;
	getTextSize?: GetTextSize;
	tuneNumber: number;
	graceSlurs: boolean;
	jazzchords: boolean;
	accentAbove: boolean;
	germanAlphabet: boolean;
	slurs: Slurs;
	ties: any[];
	voiceScale: number;
	slursbyvoice: Slursbyvoice;
	tiesbyvoice: Tiesbyvoice;
	endingsbyvoice: Endingsbyvoice;
	scaleByVoice: ScaleByVoice;
	colorByVoice: ColorByVoice;
	tripletmultiplier: number;
	abcline: Abcline[];
	hasVocals: boolean;
	minY?: any;
	startlimitelem: AbsoluteElement;
	stemdir?: any;
	stemHeight: number;
	measureLength: number;
	tempoSet: boolean;
	triplet?: any;
}

interface Abcline {
	type: string;
	el_type: string;
	startChar: number;
	endChar: number;
	abselem: AbsoluteElement;
	rest?: Rest;
	duration: number;
	averagepitch: number;
	minpitch: number;
	maxpitch: number;
	pitches?: Pitches[];
	lyric?: Lyric;
	endSlur?: Object; // [Circular: endSlur]
	decoration?: Decoration;
	startTriplet: number;
	tripletMultiplier: number;
	tripletR: number;
	endTriplet: boolean;
	startEnding: string;
	endEnding: boolean;
}

interface ColorByVoice {
}

interface ScaleByVoice {
	s0v0: number;
	s1v0: number;
	s2v0: number;
}

interface Endingsbyvoice {
	s0v0?: any;
}

interface Tiesbyvoice {
	s0v0: any[];
	s1v0: any[];
	s2v0?: Object; // [Circular: ties]
}

interface Slursbyvoice {
	s0v0: S0v0;
	s1v0: S1v0;
	s2v0?: Object; // [Circular: slurs]
}

interface S1v0 {
}

interface S0v0 {
}

interface Slurs {
}

/** @class Decoration */
interface Decoration {
	minTop: number;
	minBottom: number;
}

/** @class Renderer */
interface Renderer {
	paper?: Svg;
	controller?: EngraverController;
	space: number;
	padding: Padding;
	y: number;
	abctune?: Tune;
	path?: any;
	isPrint: boolean;
	lineThickness: number;
	spacing: Spacing;
	firefox112: boolean;
	paddingOverride: PaddingOverride;
	foregroundColor: string;
	minPadding: number;
	staffbottom: number;
}

interface PaddingOverride {
}

interface Spacing {
	composer: number;
	graceBefore: number;
	graceInside: number;
	graceAfter: number;
	info: number;
	lineSkipFactor: number;
	music: number;
	paragraphSkipFactor: number;
	parts: number;
	slurHeight: number;
	staffSeparation: number;
	staffTopMargin: number;
	stemHeight: number;
	subtitle: number;
	systemStaffSeparation: number;
	text: number;
	title: number;
	top: number;
	vocal: number;
	words: number;
}

interface Padding {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

/** @class BottomText */
interface BottomText {
	rows: Rows[];
}

/** @class TopText */
interface TopText {
	rows: Rows[];
}

interface Rows {
	left: number;
	text: string;
	font: string;
	anchor: string;
	startChar: number;
	endChar: number;
	absElemType: string;
	name: string;
	move: number;
}
interface MetaText {
	footer: Footer;
	"abc-version": string;
	title: string;
	book: string;
	composer: string;
	discography: string;
	url: string;
	group: string;
	history: string;
	instruction: string;
	unalignedWords: any[];
	notes: string;
	origin: string;
	rhythm: string;
	source: string;
	transcription: string;
	tempo: Tempo;
}

interface MetaTextInfo {
	footer: Footer;
	"abc-version": CharLocation;
	title: CharLocation;
	book: CharLocation;
	composer: CharLocation;
	discography: CharLocation;
	url: CharLocation;
	group: CharLocation;
	history: CharLocation;
	instruction: CharLocation;
	unalignedWords: CharLocation;
	notes: CharLocation;
	origin: CharLocation;
	rhythm: CharLocation;
	source: CharLocation;
	transcription: CharLocation;
}

interface CharLocation {
	startChar: number;
	endChar: number;
}
interface Tempo {
	accidentals: Accidentals[];
	root: string;
	acc: string;
	mode: string;
	el_type: string;
	abselem: AbsoluteElement;
	type: string;
	startChar: number;
	endChar: number;
	preString: string;
	duration: any[];
	bpm: number;
}

interface Footer {
	left: string;
	center: string;
	right: string;
}

interface Lines {
	staff: Staff[];
	staffGroup: StaffGroupElement;
}

/** @class StaffGroupElement */
interface StaffGroupElement {
	getTextSize: GetTextSize;
	voices: VoiceElement[];
	staffs: Staffs[];
	bracket: BraceElem[];
	startx: number;
	w: number;
	height: number;
	line: number;
}

/** @class BraceElem */
interface BraceElem {
	startVoice: VoiceElement;
	type: string;
	lastContinuedVoice: VoiceElement;
	endVoice: VoiceElement;
	x: number;
	startY: number;
	endY: number;
	elemset: SVGPathElement;
}

interface Staffs {
	top: number;
	bottom: number;
	lines: number;
	voices?: Voice[][];
	specialY?: SpecialY;
	absoluteY: number;
	bottomLine: number;
	topLine: number;
}

/** @class VoiceElement */
interface VoiceElement {
	children: AbsoluteElement[];
	beams: BeamElem[];
	otherchildren: TieElem[];
	w: number;
	duplicate: boolean;
	voicenumber: number;
	voicetotal: number;
	bottom: number;
	top: number;
	specialY: SpecialY;
	barfrom: boolean;
	barto: boolean;
	header: string;
	headerPosition: number;
	staff: Staff;
	i: number;
	durationindex: number;
	startx: number;
	minx: number;
	nextx: number;
	spacingduration: number;
}

/** @class TieElem */
interface TieElem {
	type: string;
	anchor1: RelativeElement;
	anchor2: RelativeElement;
	voiceNumber: number;
	internalNotes: RelativeElement[];
	top: number;
	bottom: number;
	startLimitX: AbsoluteElement;
	above: boolean;
	startX: number;
	endX: number;
	startY: number;
	endY: number;
	isTie: boolean;
	elemset: SVGPathElement[];
	number: number;
	durationClass: string;
	endingHeightAbove: number;
	hasBeam: boolean;
	startNote: number;
	endNote: number;
	yTextPos: number;
	xTextPos: number;
	stemDir: string;
	text: string;
	pitch: number;
	anchor: AbsoluteElement;
	dec: string;
	volumeHeightAbove: number;
}

/** @class BeamElem */
interface BeamElem {
	type: string;
	isflat: boolean;
	isgrace: boolean;
	forceup: boolean;
	forcedown: boolean;
	elems: AbsoluteElement[];
	total: number;
	average: number;
	allrests: boolean;
	stemHeight: number;
	beams: BeamElem[];
	duration: number;
	stemsUp: boolean;
	min: number;
	max: number;
}

/** @class GetTextSize */
interface GetTextSize {
	getFontAndAttr: GetFontAndAttr;
	svg: Svg;
}

/** @class Svg */
interface Svg {
	svg: SVGSVGElement;
	currentGroup: any[];
}

/** @element svg */
/** @class SVGSVGElement */
interface SVGSVGElement {
}

/** @class GetFontAndAttr */
interface GetFontAndAttr {
	formatting?: Formatting;
	classes: Classes;
}

/** @class Classes */
interface Classes {
	lineNumber?: any;
	voiceNumber?: any;
	measureNumber?: any;
	measureTotalPerLine: any[];
	noteNumber?: any;
}

interface Staff {
	voices: Voice[][];
	clef: Clef;
	key: KeySignature;
	bracket: string;
	title: any[];
	meter: Meter;
}

interface Meter {
	type: string;
	el_type?: string;
	abselem?: AbsoluteElement;
	value?: MeterValue;
}
interface MeterValue {
	num: number,
	den: number
}
interface KeySignature {
	accidentals: Accidentals[];
	root: string;
	acc: string;
	mode: string;
	el_type: string;
	abselem: AbsoluteElement;
}

interface Accidentals {
	acc: string;
	note: string;
	verticalPos: number;
}

interface Clef {
	type: string;
	verticalPos: number;
	clefPos: number;
	el_type: string;
	abselem: AbsoluteElement;
}

interface Voice {
	type: string;
	el_type: string;
	startChar: number;
	endChar: number;
	abselem: AbsoluteElement;
	rest: Rest;
	duration: number;
	averagepitch: number;
	minpitch: number;
	maxpitch: number;
	pitches: Pitches[];
	lyric: Lyric[];
	endSlur?: Object; // [Circular: endSlur]
	decoration?: Decoration;
	startTriplet: number;
	tripletMultiplier: number;
	tripletR: number;
	endTriplet: boolean;
}

/** @class AbsoluteElement */
interface AbsoluteElement {
	tuneNumber: number;
	abcelem: Abcelem;
	duration: number;
	durationClass: number;
	minspacing: number;
	x: number;
	children: RelativeElement[];
	heads: RelativeElement[];
	extra: RelativeElement[];
	extraw: number;
	w: number;
	right: RelativeElement[];
	invisible: boolean;
	bottom: number;
	top: number;
	type: string;
	fixed: Fixed;
	specialY: SpecialY;
	elemset: SVGGElement[];
	counters: Counters;
	notePositions: NotePositions[];
	startTie: boolean;
}

interface NotePositions {
	x: number;
	y: number;
}

interface Counters {
	line: number;
	measure: number;
	measureTotal: number;
	voice: number;
	note: number;
}

/** @element g */
/** @class SVGGElement */
interface SVGGElement {
}

interface SpecialY {
	tempoHeightAbove: number;
	partHeightAbove: number;
	volumeHeightAbove: number;
	dynamicHeightAbove: number;
	endingHeightAbove: number;
	chordHeightAbove: number;
	lyricHeightAbove: number;
	lyricHeightBelow: number;
	chordHeightBelow: number;
	volumeHeightBelow: number;
	dynamicHeightBelow: number;
}

interface Fixed {
	w: number;
	t: number;
	b: number;
}

/** @class RelativeElement */
interface RelativeElement {
	x: number;
	c: string;
	dx: number;
	w: number;
	pitch: number;
	scalex: number;
	scaley: number;
	type: string;
	pitch2: number;
	linewidth: number;
	klass: string;
	anchor: string;
	top: number;
	bottom: number;
	height: number;
	name: string;
	realWidth: number;
	centerVertically: boolean;
	graphelem: SVGPathElement;
	stemDir: string;
	highestVert: number;
	dim: Dim;
	position: string;
	lyricHeightBelow: number;
}

interface Dim {
	font: Font;
	attr: Attr;
}

interface Attr {
	"font-size": number;
	"font-style": string;
	"font-family": string;
	"font-weight": string;
	"text-decoration": string;
	class: string;
	"text-anchor": string;
	x: number;
	y: number;
	"data-name": string;
}

interface Font {
	face: string;
	size: number;
	decoration: string;
	style: string;
	weight: string;
	padding: number;
}

/** @element path */
/** @class SVGPathElement */
interface SVGPathElement {
}

interface Abcelem {
	type: string;
	el_type: string;
	startChar: number;
	endChar: number;
	abselem: AbsoluteElement;
	rest: Rest;
	duration: number;
	averagepitch: number;
	minpitch: number;
	maxpitch: number;
	pitches: Pitches[];
	lyric: Lyric[];
	endSlur: any[];
	decoration: any[];
	startTriplet: number;
	tripletMultiplier: number;
	tripletR: number;
	endTriplet: boolean;
	startBeam: boolean;
	startEnding: string;
	endEnding: boolean;
	endBeam: boolean;
	verticalPos: number;
	clefPos: number;
	chord: Chord[];
}

interface Chord {
	name: string;
	position: string;
}

interface Lyric {
	syllable: string;
	divider: string;
}

interface Pitches {
	accidental: string;
	pitch: number;
	name: string;
	startSlur: StartSlur[];
	verticalPos: number;
	highestVert: number;
	startTie: StartTie;
	endTie: boolean;
	printer_shift: string;
	endSlur: any[];
}

interface StartTie {
}

interface StartSlur {
	label: number;
}

interface Rest {
	type: string;
	text: number;
}

interface Formatting {
	composerfont: Font;
	subtitlefont: Font;
	tempofont: Font;
	titlefont: Font;
	footerfont: Font;
	headerfont: Font;
	voicefont: Font;
	tablabelfont: Font;
	tabnumberfont: Font;
	tabgracefont: Font;
	annotationfont: Font;
	gchordfont: Font;
	historyfont: Font;
	infofont: Font;
	measurefont: Font;
	partsfont: Font;
	repeatfont: Font;
	textfont: Font;
	tripletfont: Font;
	vocalfont: Font;
	wordsfont: Font;
	pagewidth: number;
	pageheight: number;
	topspace: number;
	topmargin: number;
	botmargin: number;
	leftmargin: number;
	rightmargin: number;
	titlespace: number;
	midi: Midi;
}

interface Midi {
	program: any[];
}

