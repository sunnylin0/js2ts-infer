import StringTablature from './string-tablature';
import tabRenderer from '../render/tab-renderer';
import StringPatterns from './string-patterns';
export class PluginInstance {
    constructor() {
        this.tune = null;
        this.params = null;
        this.tuneNumber = 0;
        this.inError = false;
        this.abcTune = null;
        this.linePitch = 3;
        this.nbLines = 0;
        this.isTabBig = false;
        this.tabSymbolOffset = 0;
        this.capo = 0;
        this.transpose = 0;
        this.hideTabSymbol = false;
        this.tablature = null;
        this.tuning = [];
        this.semantics = null;
        this.error = null;
        this.clefTranspose = 0;
    }
    init(abcTune, tuneNumber, params, tabSettings) {
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
    setError(error) {
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
    render(renderer, line, staffIndex) {
        if (this.inError)
            return;
        if (this.tablature && this.tablature.bypass(line))
            return;
        tabRenderer(this, renderer, line, staffIndex);
    }
}
export default function AbcStringTab() {
    return { name: 'StringTab', tablature: PluginInstance };
}
