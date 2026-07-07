import CreateSynthControl from './create-synth-control';
import CreateSynth from './create-synth';
// @ts-ignore
import TimingCallbacks from '../api/abc_timing_callbacks';
import activeAudioContext from './active-audio-context';
export default class SynthController {
    warp = 100;
    cursorControl = null;
    visualObj = null;
    timer = null;
    midiBuffer = null;
    options = null;
    currentTempo = null;
    control = null;
    isLooping = false;
    isStarted = false;
    isLoaded = false;
    isLoading = false;
    percent = 0;

    constructor() {
        // Bind handlers
        this.toggleLoop = this.toggleLoop.bind(this);
        this.restart = this.restart.bind(this);
        this.play = this.play.bind(this);
        this.randomAccess = this.randomAccess.bind(this);
        this.onWarp = this.onWarp.bind(this);
        this.beatCallback = this.beatCallback.bind(this);
        this.eventCallback = this.eventCallback.bind(this);
        this.lineEndCallback = this.lineEndCallback.bind(this);
    }
    load(selector, cursorControl, visualOptions = {}): void {
        if (visualOptions.displayPlay === undefined)
            visualOptions.displayPlay = true;
        if (visualOptions.displayProgress === undefined)
            visualOptions.displayProgress = true;
        this.control = new CreateSynthControl(selector, {
            loopHandler: visualOptions.displayLoop ? this.toggleLoop : undefined,
            restartHandler: visualOptions.displayRestart ? this.restart : undefined,
            playPromiseHandler: visualOptions.displayPlay ? this.play : undefined,
            progressHandler: visualOptions.displayProgress ? this.randomAccess : undefined,
            warpHandler: visualOptions.displayWarp ? this.onWarp : undefined,
            afterResume: () => this.go() // Simplified from 'init'
        });
        this.cursorControl = cursorControl;
        this.disable(true);
    }
    disable(isDisabled: boolean): void {
        if (this.control)
            this.control.disable(isDisabled);
    }
    setTune(visualObj, userAction, audioParams) {
        this.visualObj = visualObj;
        this.disable(false);
        this.options = audioParams ? audioParams : {};
        if (this.control) {
            this.pause();
            this.setProgress(0, 1);
            this.control.resetAll();
            this.restart();
            this.isStarted = false;
        }
        this.isLooping = false;
        if (userAction)
            return this.go();
        else {
            return Promise.resolve({ status: "no-audio-context" });
        }
    }
    go() {
        if (!this.visualObj)
            return Promise.resolve({ status: "error", message: "No visual object" });
        this.isLoading = true;
        const millisecondsPerMeasure: number = this.visualObj.millisecondsPerMeasure() * 100 / this.warp;
        this.currentTempo = Math.round(this.visualObj.getBeatsPerMeasure() / millisecondsPerMeasure * 60000);
        if (this.control)
            this.control.setTempo(this.currentTempo);
        this.percent = 0;
        let loadingResponse;
        if (!this.midiBuffer)
            this.midiBuffer = new CreateSynth();
        const ac = activeAudioContext();
        return (ac ? ac.resume() : Promise.resolve()).then(() => {
            return this.midiBuffer.init({
                visualObj: this.visualObj,
                options: this.options,
                millisecondsPerMeasure: millisecondsPerMeasure
            });
        }).then((response) => {
            loadingResponse = response;
            return this.midiBuffer.prime();
        }).then(() => {
            let subdivisions: number = 16;
            if (this.cursorControl &&
                this.cursorControl.beatSubdivisions !== undefined &&
                parseInt(this.cursorControl.beatSubdivisions, 10) >= 1 &&
                parseInt(this.cursorControl.beatSubdivisions, 10) <= 64)
                subdivisions = parseInt(this.cursorControl.beatSubdivisions, 10);
            this.timer = new TimingCallbacks(this.visualObj, {
                beatCallback: this.beatCallback,
                eventCallback: this.eventCallback,
                lineEndCallback: this.lineEndCallback,
                qpm: this.currentTempo,
                extraMeasuresAtBeginning: this.cursorControl ? this.cursorControl.extraMeasuresAtBeginning : undefined,
                lineEndAnticipation: this.cursorControl ? this.cursorControl.lineEndAnticipation : 0,
                beatSubdivisions: subdivisions,
            });
            if (this.cursorControl && this.cursorControl.onReady && typeof this.cursorControl.onReady === 'function')
                this.cursorControl.onReady(this);
            this.isLoaded = true;
            this.isLoading = false;
            return Promise.resolve({ status: "created", notesStatus: loadingResponse });
        });
    }
    destroy(): void {
        if (this.timer) {
            this.timer.reset();
            this.timer.stop();
            this.timer = null;
        }
        if (this.midiBuffer) {
            this.midiBuffer.stop();
            this.midiBuffer = null;
        }
        this.setProgress(0, 1);
        if (this.control)
            this.control.resetAll();
    }
    play() {
        return this.runWhenReady(() => this._play());
    }
    sleep(ms: number): Promise<unknown> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
    runWhenReady(fn, arg1): Promise<any> {
        if (!this.visualObj)
            return Promise.resolve({ status: "loading" });
        if (this.isLoading) {
            return this.sleep(500).then(() => {
                if (this.isLoading)
                    return this.runWhenReady(fn, arg1);
                return fn(arg1);
            });
        }
        else if (!this.isLoaded) {
            return this.go().then(() => {
                return fn(arg1);
            });
        }
        else {
            return fn(arg1);
        }
    }
    _play() {
        const ac = activeAudioContext();
        return (ac ? ac.resume() : Promise.resolve()).then(() => {
            this.isStarted = !this.isStarted;
            if (this.isStarted) {
                if (this.cursorControl && this.cursorControl.onStart && typeof this.cursorControl.onStart === 'function')
                    this.cursorControl.onStart();
                this.midiBuffer.start();
                this.timer.start(this.percent);
                if (this.control)
                    this.control.pushPlay(true);
            }
            else {
                this.pause();
            }
            return Promise.resolve({ status: "ok" });
        });
    }
    pause(): void {
        if (this.timer) {
            this.timer.pause();
            this.midiBuffer.pause();
            if (this.control)
                this.control.pushPlay(false);
        }
    }
    toggleLoop(): void {
        this.isLooping = !this.isLooping;
        if (this.control)
            this.control.pushLoop(this.isLooping);
    }
    restart(): void {
        if (this.timer) {
            this.timer.setProgress(0);
            this.midiBuffer.seek(0, "percent");
        }
    }
    randomAccess(ev): Promise<any> {
        return this.runWhenReady((e) => this._randomAccess(e), ev);
    }
    _randomAccess(ev) {
        const background = (ev.target.classList.contains('abcjs-midi-progress-indicator')) ? ev.target.parentNode : ev.target;
        let percent: number = (ev.x - background.getBoundingClientRect().left) / background.offsetWidth;
        if (percent < 0)
            percent = 0;
        if (percent > 1)
            percent = 1;
        this.seek(percent, "percent");
        return Promise.resolve({ status: "ok" });
    }
    seek(percent: number, units: string): void {
        if (this.timer && this.midiBuffer) {
            this.timer.setProgress(percent, units);
            this.midiBuffer.seek(percent, units);
        }
    }
    setWarp(newWarp): Promise<void> {
        const warpVal = typeof newWarp === 'string' ? parseInt(newWarp, 10) : newWarp;
        if (warpVal > 0) {
            this.warp = warpVal;
            const wasPlaying: boolean = this.isStarted;
            const startPercent: number = this.percent;
            this.destroy();
            this.isStarted = false;
            return this.go().then(() => {
                this.setProgress(startPercent, (this.midiBuffer?.duration || 0) * 1000);
                if (this.control)
                    this.control.setWarp(this.currentTempo, this.warp);
                if (wasPlaying) {
                    return this.play().then(() => {
                        this.seek(startPercent, "percent");
                        return Promise.resolve();
                    });
                }
                this.seek(startPercent, "percent");
                return Promise.resolve();
            });
        }
        return Promise.resolve();
    }
    onWarp(ev): Promise<void> {
        return this.setWarp(ev.target.value);
    }
    setProgress(percent: number, totalTime: number): void {
        this.percent = percent;
        if (this.control)
            this.control.setProgress(percent, totalTime);
    }
    finished(): string {
        this.timer.reset();
        if (this.isLooping) {
            this.timer.start(0);
            this.midiBuffer.finished();
            this.midiBuffer.start();
            return "continue";
        }
        else {
            this.timer.stop();
            if (this.isStarted) {
                if (this.control)
                    this.control.pushPlay(false);
                this.isStarted = false;
                this.midiBuffer.finished();
                if (this.cursorControl && this.cursorControl.onFinished && typeof this.cursorControl.onFinished === 'function')
                    this.cursorControl.onFinished();
                this.setProgress(0, 1);
            }
        }
        return undefined;
    }
    beatCallback(beatNumber, totalBeats, totalTime, position): void {
        const percent: number = beatNumber / totalBeats;
        this.setProgress(percent, totalTime);
        if (this.cursorControl && this.cursorControl.onBeat && typeof this.cursorControl.onBeat === 'function')
            this.cursorControl.onBeat(beatNumber, totalBeats, totalTime, position);
    }
    eventCallback(event): string {
        if (event) {
            if (this.cursorControl && this.cursorControl.onEvent && typeof this.cursorControl.onEvent === 'function')
                this.cursorControl.onEvent(event);
        }
        else {
            return this.finished();
        }
        return undefined;
    }
    lineEndCallback(lineEvent, leftEvent): void {
        if (this.cursorControl && this.cursorControl.onLineEnd && typeof this.cursorControl.onLineEnd === 'function')
            this.cursorControl.onLineEnd(lineEvent, leftEvent);
    }
    getUrl() {
        return this.midiBuffer ? this.midiBuffer.download() : "";
    }
    download(fileName): void {
        const url = this.getUrl();
        if (!url)
            return;
        const link: HTMLAnchorElement = document.createElement('a');
        document.body.appendChild(link);
        link.setAttribute("style", "display: none;");
        link.href = url;
        link.download = fileName ? fileName : 'output.wav';
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
    }
}
