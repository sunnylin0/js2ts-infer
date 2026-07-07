import StringTablature from './string-tablature';
import tabRenderer from '../render/tab-renderer';
import StringPatterns from './string-patterns';
export class PluginInstance {
    tune = null;
    params = null;
    tuneNumber = 0;
    inError = false;
    abcTune = null;
    linePitch = 3;
    nbLines = 0;
    isTabBig = false;
    tabSymbolOffset = 0;
    capo = 0;
    transpose = 0;
    hideTabSymbol = false;
    tablature = null;
    tuning = [];
    semantics = null;
    error = null;
    clefTranspose = 0;

    constructor() {
    }
    init(abcTune, tuneNumber, params, tabSettings): void {
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
    setError(error): void {
        if (error) {
            this.error = error;
            this.inError = true;
            if (this.tune.warnings) {
                this.tune.warnings.push(error);
            }
            else {
                this.tune.warnings = [error];
            }
        }
    }
    render(renderer, line, staffIndex): void {
        if (this.inError)
            return;
        if (this.tablature && this.tablature.bypass(line))
            return;
        tabRenderer(this, renderer, line, staffIndex);
    }
}
export default function AbcStringTab(): PluginInstance {
    return { name: 'StringTab', tablature: PluginInstance };
}
