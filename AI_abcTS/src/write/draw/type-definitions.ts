/**
 * Internal Type Definitions for abcjs Rendering
 */

export interface Renderer {
	paper: Paper;
	controller: Controller;
	calcY: (pitch: number) => number;
	yToPitch: (y: number) => number;
	moveY: (em: number, numLines?: number) => void;
	absolutemoveY: (y: number) => void;
	lineThickness: number;
	spacing: Record<string, number>;
	padding: Record<string, number>;
	y: number;
	isPrint: boolean;
	foregroundColor?: string;
}

export interface Paper {
	svg: SVGSVGElement;
	setAttributeOnElement: (elem: SVGElement, attrs: Record<string, any>) => void;
	openGroup: (options?: any) => SVGGElement;
	closeGroup: () => SVGGElement | null;
	path: (attr: any) => SVGPathElement;
	text: (text: string | number, attr: any, target?: SVGElement, spanAttr?: any) => SVGTextElement;
	rect: (attr: any) => SVGPathElement;
	rectBeneath: (attr: any) => any;
	lineToBack: (attr: any) => SVGLineElement;
	richTextLine: (phrases: any[], x: number, y: number, klass: string, anchor: string) => SVGGElement;
	setTitle: (text: string) => void;
	setAttribute: (name: string, value: string) => void;
	insertStyles: (styles: string) => void;
	setResponsiveWidth: (width: number, height: number) => void;
	setSize: (width: number, height: number) => void;
	setScale: (scale: number) => void;
	setParentStyles: (styles: Record<string, string>) => void;
}

export interface Controller {
	classes: ClassManager;
	selectTypes?: string[];
	renderer: Renderer;
	chordGrid?: boolean | "noMusic";
}

export interface EngraverParams {
	oneSvgPerLine?: boolean;
	selectionColor?: string;
	dragColor?: string;
	dragging?: boolean;
	selectTypes?: string[];
	responsive?: "resize" | boolean;
	initialClef?: any; // Will use ClefProperties if imported
	timeBasedLayout?: boolean;
	expandToWidest?: boolean;
	scale?: string | number;
	add_classes?: boolean;
	staffwidth?: number;
	clickListener?: (element: any, analysis: any, drag: any, mouseEvent: MouseEvent) => void;
	showDebug?: boolean;
	jazzchords?: boolean;
	accentAbove?: boolean;
	germanAlphabet?: boolean;
	lineThickness?: number;
	chordGrid?: boolean | "noMusic";
	foregroundColor?: string;
	ariaLabel?: string;
	minPadding?: number;
	paddingtop?: number;
	paddingbottom?: number;
	paddingleft?: number;
	paddingright?: number;
}

export interface ClassManager {
	generate: (name: string) => string;
	getCurrent: () => string;
}

export interface Selectables {
	add: (params: AbsoluteElement, g: SVGElement, isSelectable: boolean, staffPos: StaffPos) => void;
}

export interface StaffPos {
	top: number;
	zero: number;
	height: number;
}

export interface RelativeElement {
	type: string;
	pitch: number;
	pitch2?: number;
	x: number;
	w: number;
	c: any;
	dx: number;
	klass?: string;
	scalex?: number;
	scaley?: number;
	name?: string;
	dim?: any;
	linewidth?: number;
	isGrace?: boolean;
	centerVertically?: boolean;
	anchor?: "start" | "middle" | "end";
	getLane?: () => number;
	graphelem?: SVGElement;
	highestVert?: number;
	top?: number;
	bottom?: number;
	position?: string;
	height?: number;
	stemDir?: string;
	parent?: AbsoluteElement;
}

export interface AbsoluteElement {
	type: string;
	children: RelativeElement[];
	invisible?: boolean;
	elemset: SVGElement[];
	durationClass?: number;
	duration?: number;
	abcelem: {
		pitches?: Array<{ pitch: number, verticalPos: number, [key: string]: any }>;
		startChar?: number;
		endChar?: number;
		abselem?: AbsoluteElement;
		el_type?: string;
		type?: string;
		[key: string]: any;
	};
	cloned?: {
		overrideClasses: string;
	};
	overrideClasses?: string;
	startChar?: number;
	endChar?: number;
	klass?: string;
	hint?: boolean;
	heads: RelativeElement[];
	notePositions?: Array<{ x: number, y: number }>;
	extraw: number;
	minspacing: number;
	bottom: number;
	top: number;
	startTie?: boolean;
	addFixed: (rel: RelativeElement) => void;
	addFixedX: (rel: RelativeElement) => void;
	addRight: (rel: RelativeElement) => void;
	addHead: (rel: RelativeElement) => void;
	addExtra: (rel: RelativeElement) => void;
	addCentered: (rel: RelativeElement) => void;
	setHint: () => void;
}

export interface Voice {
	voicenumber: number;
	voicetotal: number;
	isPercussion?: boolean;
	barfrom?: boolean;
	barto?: boolean;
	duplicate?: boolean;
	header?: string;
	headerPosition?: number;
	children: any[];
	color?: string;
	addBeam: (beam: any) => void;
	addOther: (other: any) => void;
	addChild: (child: any) => void;
	setRange: (elem: any) => void;
}

export interface GlyphDef {
	d: Array<[string, ...number[]]>;
	w: number;
	h: number;
}