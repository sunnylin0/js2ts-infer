import StringTablature from './string-tablature';
import tabRenderer from '../render/tab-renderer';
import StringPatterns from './string-patterns';

export class PluginInstance {
	public tune: any = null;
	public params: any = null;
	public tuneNumber: number = 0;
	public inError: boolean = false;
	public abcTune: any = null;
	public linePitch: number = 3;
	public nbLines: number = 0;
	public isTabBig: boolean = false;
	public tabSymbolOffset: number = 0;
	public capo: number = 0;
	public transpose: number = 0;
	public hideTabSymbol: boolean = false;
	public tablature: StringTablature | null = null;
	public tuning: string[] = [];
	public semantics: StringPatterns | null = null;
	public error: string | null = null;
	public clefTranspose: number = 0;

	constructor() {}

	public init(abcTune: any, tuneNumber: number, params: any, tabSettings: any): void {
		this.tune = abcTune;
		this.params = params;
		this.tuneNumber = tuneNumber;
		this.inError = false;
		this.abcTune = abcTune;
		this.linePitch = 3;
		this.nbLines = tabSettings.defaultTuning.length;
		this.isTabBig = tabSettings.isTabBig;
		this.tabSymbolOffset = tabSettings.tabSymbolOffset;
		this.capo = params.capo;
		this.transpose = params.visualTranspose;
		this.hideTabSymbol = params.hideTabSymbol;
		this.tablature = new StringTablature(this.nbLines, this.linePitch);
		
		let tuning = params.tuning;
		if (!tuning) {
			tuning = tabSettings.defaultTuning;
		}
		this.tuning = tuning;
		this.semantics = new StringPatterns(this);
	}

	public setError(error: string): void {
		if (error) {
			this.error = error;
			this.inError = true;
			if (this.tune.warnings) {
				this.tune.warnings.push(error);
			} else {
				this.tune.warnings = [error];
			}
		}
	}

	public render(renderer: any, line: any, staffIndex: number): void {
		if (this.inError) return;
		if (this.tablature && this.tablature.bypass(line)) return;
		tabRenderer(this, renderer, line, staffIndex);
	}
}

export default function AbcStringTab(): { name: string; tablature: typeof PluginInstance } {
	return { name: 'StringTab', tablature: PluginInstance };
}
