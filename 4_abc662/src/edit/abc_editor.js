import parseCommon from '../parse/abc_common';
import SynthController from '../synth/synth-controller';
import supportsAudio from '../synth/supports-audio';
import renderAbc from '../api/abc_tunebook_svg';
import EditArea from './abc_editarea';
function gatherAbcParams(params) {
    const abcjsParams = {};
    if (params.abcjsParams) {
        Object.assign(abcjsParams, params.abcjsParams);
    }
    if (params.midi_options) {
        Object.assign(abcjsParams, params.midi_options);
    }
    if (params.parser_options) {
        Object.assign(abcjsParams, params.parser_options);
    }
    if (params.render_options) {
        Object.assign(abcjsParams, params.render_options);
    }
    if (abcjsParams.tablature && params.warnings_id) {
        abcjsParams.tablature.warnings_id = params.warnings_id;
    }
    return abcjsParams;
}
export default class Editor {
    constructor(editarea, params) {
        this.indicate_changed = false;
        this.div = null;
        this.selectionChangeCallback = null;
        this.clientClickListener = null;
        this.synth = null;
        this.generate_midi = null;
        this.downloadMidi = null;
        this.inlineMidi = null;
        this.warningsdiv = null;
        this.onchangeCallback = null;
        this.redrawCallback = null;
        this.currentAbc = "";
        this.tunes = [];
        this.bReentry = false;
        this.timerId = null;
        this.bIsPaused = false;
        this.midiPause = false;
        this.wasDirty = false;
        this.warnings = [];
        this.abcjsParams = gatherAbcParams(params);
        if (params.indicate_changed)
            this.indicate_changed = true;
        if (editarea instanceof EditArea) {
            this.editarea = editarea;
        }
        else {
            this.editarea = new EditArea(editarea);
        }
        this.editarea.addSelectionListener(this);
        this.editarea.addChangeListener(this);
        let canvasId = params.canvas_id || params.paper_id;
        if (canvasId) {
            this.div = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
        }
        else {
            this.div = document.createElement("DIV");
            const el = this.editarea.getElem();
            if (el.parentNode)
                el.parentNode.insertBefore(this.div, el);
        }
        if (params.selectionChangeCallback) {
            this.selectionChangeCallback = params.selectionChangeCallback;
        }
        this.clientClickListener = this.abcjsParams.clickListener;
        this.abcjsParams.clickListener = this.highlight.bind(this);
        if (params.synth && supportsAudio()) {
            this.synth = {
                el: params.synth.el,
                cursorControl: params.synth.cursorControl,
                options: params.synth.options
            };
        }
        if (params.generate_midi) {
            this.generate_midi = params.generate_midi;
            if (this.abcjsParams.generateDownload) {
                this.downloadMidi = typeof params.midi_download_id === 'string' ? document.getElementById(params.midi_download_id) : params.midi_download_id;
            }
            if (this.abcjsParams.generateInline !== false) {
                this.inlineMidi = typeof params.midi_id === 'string' ? document.getElementById(params.midi_id) : params.midi_id;
            }
        }
        if (params.warnings_id) {
            this.warningsdiv = typeof params.warnings_id === 'string' ? document.getElementById(params.warnings_id) : params.warnings_id;
        }
        else if (params.generate_warnings) {
            this.warningsdiv = document.createElement("div");
            if (this.div && this.div.parentNode)
                this.div.parentNode.insertBefore(this.warningsdiv, this.div);
        }
        this.onchangeCallback = params.onchange;
        this.redrawCallback = params.redrawCallback;
        this.parseABC();
        this.modelChanged();
    }
    addClassName(element, className) {
        const hasClassName = (el, name) => {
            const elClassName = el.className;
            return (elClassName.length > 0 && (elClassName === name ||
                new RegExp("(^|\\s)" + name + "(\\s|$)").test(elClassName)));
        };
        if (!hasClassName(element, className))
            element.className += (element.className ? ' ' : '') + className;
        return element;
    }
    removeClassName(element, className) {
        element.className = parseCommon.strip(element.className.replace(new RegExp("(^|\\s+)" + className + "(\\s+|$)"), ' '));
        return element;
    }
    setReadOnly(readOnly) {
        const readonlyClass = 'abc_textarea_readonly';
        const el = this.editarea.getElem();
        if (readOnly) {
            el.setAttribute('readonly', 'yes');
            this.addClassName(el, readonlyClass);
        }
        else {
            el.removeAttribute('readonly');
            this.removeClassName(el, readonlyClass);
        }
    }
    redrawMidi() {
        if (this.generate_midi && !this.midiPause) {
            const event = new CustomEvent("generateMidi", {
                detail: {
                    tunes: this.tunes,
                    abcjsParams: this.abcjsParams,
                    downloadMidiEl: this.downloadMidi,
                    inlineMidiEl: this.inlineMidi,
                    engravingEl: this.div
                }
            });
            window.dispatchEvent(event);
        }
        if (this.synth) {
            const userAction = !!this.synth.synthControl;
            if (!this.synth.synthControl) {
                this.synth.synthControl = new SynthController();
                this.synth.synthControl.load(this.synth.el, this.synth.cursorControl, this.synth.options);
            }
            this.synth.synthControl.setTune(this.tunes[0], userAction, this.synth.options);
        }
    }
    modelChanged() {
        if (this.bReentry)
            return;
        this.bReentry = true;
        try {
            this.timerId = null;
            if (this.redrawCallback)
                this.redrawCallback(true);
            if (this.synth && this.synth.synthControl)
                this.synth.synthControl.disable(true);
            this.tunes = renderAbc(this.div, this.currentAbc, this.abcjsParams);
            if (this.tunes.length > 0) {
                this.warnings = this.tunes[0].warnings || [];
            }
            this.redrawMidi();
            if (this.redrawCallback)
                this.redrawCallback(false);
        }
        catch (error) {
            console.error("ABCJS error: ", error);
            if (!this.warnings)
                this.warnings = [];
            this.warnings.push(error.message);
        }
        if (this.warningsdiv) {
            this.warningsdiv.innerHTML = (this.warnings && this.warnings.length > 0) ? this.warnings.join("<br />") : "No errors";
        }
        this.updateSelection();
        this.bReentry = false;
    }
    paramChanged(engraverParams) {
        if (engraverParams) {
            Object.assign(this.abcjsParams, engraverParams);
        }
        this.currentAbc = "";
        this.fireChanged();
    }
    getTunes() {
        return this.tunes;
    }
    synthParamChanged(options) {
        if (!this.synth)
            return;
        this.synth.options = Object.assign({}, options);
        this.currentAbc = "";
        this.fireChanged();
    }
    parseABC() {
        const t = this.editarea.getString();
        if (t === this.currentAbc) {
            this.updateSelection();
            return false;
        }
        this.currentAbc = t;
        return true;
    }
    updateSelection() {
        const selection = this.editarea.getSelection();
        try {
            if (this.tunes.length > 0 && this.tunes[0].engraver)
                this.tunes[0].engraver.rangeHighlight(selection.start, selection.end);
        }
        catch (e) { }
        if (this.selectionChangeCallback)
            this.selectionChangeCallback(selection.start, selection.end);
    }
    fireSelectionChanged() {
        this.updateSelection();
    }
    setDirtyStyle(isDirty) {
        if (!this.indicate_changed)
            return;
        const dirtyClass = 'abc_textarea_dirty';
        const el = this.editarea.getElem();
        if (isDirty) {
            this.addClassName(el, dirtyClass);
        }
        else {
            this.removeClassName(el, dirtyClass);
        }
    }
    fireChanged() {
        if (this.bIsPaused)
            return;
        if (this.parseABC()) {
            if (this.timerId)
                clearTimeout(this.timerId);
            this.timerId = setTimeout(() => {
                this.modelChanged();
            }, 300);
            const isDirty = this.isDirty();
            if (this.wasDirty !== isDirty) {
                this.wasDirty = isDirty;
                this.setDirtyStyle(isDirty);
            }
            if (this.onchangeCallback)
                this.onchangeCallback(this);
        }
    }
    setNotDirty() {
        this.editarea.initialText = this.editarea.getString();
        this.wasDirty = false;
        this.setDirtyStyle(false);
    }
    isDirty() {
        if (!this.indicate_changed)
            return false;
        return this.editarea.initialText !== this.editarea.getString();
    }
    highlight(abcelem, tuneNumber, classes, analysis, drag, mouseEvent) {
        this.editarea.setSelection(abcelem.startChar, abcelem.endChar);
        if (this.selectionChangeCallback)
            this.selectionChangeCallback(abcelem.startChar, abcelem.endChar);
        if (this.clientClickListener)
            this.clientClickListener(abcelem, tuneNumber, classes, analysis, drag, mouseEvent);
    }
    pause(shouldPause) {
        this.bIsPaused = shouldPause;
        if (!shouldPause)
            this.fireChanged();
    }
    millisecondsPerMeasure() {
        if (!this.synth || !this.synth.synthControl || !this.synth.synthControl.visualObj)
            return 0;
        return this.synth.synthControl.visualObj.millisecondsPerMeasure();
    }
    pauseMidi(shouldPause) {
        this.midiPause = shouldPause;
        if (!shouldPause)
            this.redrawMidi();
    }
}
