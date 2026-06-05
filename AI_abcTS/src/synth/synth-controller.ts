import CreateSynthControl from './create-synth-control';
import CreateSynth from './create-synth';
// @ts-ignore
import TimingCallbacks from '../api/abc_timing_callbacks';
import activeAudioContext from './active-audio-context';

export default class SynthController {
	public warp: number = 100;
	public cursorControl: any = null;
	public visualObj: any = null;
	public timer: any = null;
	public midiBuffer: CreateSynth | null = null;
	public options: any = null;
	public currentTempo: number | null = null;
	public control: any = null;
	public isLooping: boolean = false;
	public isStarted: boolean = false;
	public isLoaded: boolean = false;
	public isLoading: boolean = false;
	private percent: number = 0;

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

	public load(selector: string | HTMLElement, cursorControl?: any, visualOptions: any = {}): void {
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

	public disable(isDisabled: boolean): void {
		if (this.control)
			this.control.disable(isDisabled);
	}

	public setTune(visualObj: any, userAction: boolean, audioParams?: any): Promise<any> {
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

	public go(): Promise<any> {
		if (!this.visualObj) return Promise.resolve({ status: "error", message: "No visual object" });
		this.isLoading = true;
		const millisecondsPerMeasure = this.visualObj.millisecondsPerMeasure() * 100 / this.warp;
		this.currentTempo = Math.round(this.visualObj.getBeatsPerMeasure() / millisecondsPerMeasure * 60000);
		if (this.control)
			this.control.setTempo(this.currentTempo);
		this.percent = 0;
		let loadingResponse: any;

		if (!this.midiBuffer)
			this.midiBuffer = new CreateSynth();
		
		const ac = activeAudioContext();
		return (ac ? ac.resume() : Promise.resolve()).then(() => {
			return this.midiBuffer!.init({
				visualObj: this.visualObj,
				options: this.options,
				millisecondsPerMeasure: millisecondsPerMeasure
			});
		}).then((response: any) => {
			loadingResponse = response;
			return this.midiBuffer!.prime();
		}).then(() => {
			let subdivisions = 16;
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

	public destroy(): void {
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

	public play(): Promise<any> {
		return this.runWhenReady(() => this._play());
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(resolve, ms);
		});
	}

	public runWhenReady(fn: (arg?: any) => Promise<any>, arg1?: any): Promise<any> {
		if (!this.visualObj)
			return Promise.resolve({ status: "loading" });
		if (this.isLoading) {
			return this.sleep(500).then(() => {
				if (this.isLoading)
					return this.runWhenReady(fn, arg1);
				return fn(arg1);
			});
		} else if (!this.isLoaded) {
			return this.go().then(() => {
				return fn(arg1);
			});
		} else {
			return fn(arg1);
		}
	}

	private _play(): Promise<any> {
		const ac = activeAudioContext();
		return (ac ? ac.resume() : Promise.resolve()).then(() => {
			this.isStarted = !this.isStarted;
			if (this.isStarted) {
				if (this.cursorControl && this.cursorControl.onStart && typeof this.cursorControl.onStart === 'function')
					this.cursorControl.onStart();
				this.midiBuffer!.start();
				this.timer.start(this.percent);
				if (this.control)
					this.control.pushPlay(true);
			} else {
				this.pause();
			}
			return Promise.resolve({ status: "ok" });
		});
	}

	public pause(): void {
		if (this.timer) {
			this.timer.pause();
			this.midiBuffer!.pause();
			if (this.control)
				this.control.pushPlay(false);
		}
	}

	public toggleLoop(): void {
		this.isLooping = !this.isLooping;
		if (this.control)
			this.control.pushLoop(this.isLooping);
	}

	public restart(): void {
		if (this.timer) {
			this.timer.setProgress(0);
			this.midiBuffer!.seek(0, "percent");
		}
	}

	public randomAccess(ev: any): Promise<any> {
		return this.runWhenReady((e) => this._randomAccess(e), ev);
	}

	private _randomAccess(ev: any): Promise<any> {
		const background = (ev.target.classList.contains('abcjs-midi-progress-indicator')) ? ev.target.parentNode : ev.target;
		let percent = (ev.x - background.getBoundingClientRect().left) / background.offsetWidth;
		if (percent < 0) percent = 0;
		if (percent > 1) percent = 1;
		this.seek(percent, "percent");
		return Promise.resolve({ status: "ok" });
	}

	public seek(percent: number, units: string): void {
		if (this.timer && this.midiBuffer) {
			this.timer.setProgress(percent, units);
			this.midiBuffer.seek(percent, units);
		}
	}

	public setWarp(newWarp: number | string): Promise<any> {
		const warpVal = typeof newWarp === 'string' ? parseInt(newWarp, 10) : newWarp;
		if (warpVal > 0) {
			this.warp = warpVal;
			const wasPlaying = this.isStarted;
			const startPercent = this.percent;
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

	public onWarp(ev: any): Promise<any> {
		return this.setWarp(ev.target.value);
	}

	public setProgress(percent: number, totalTime: number): void {
		this.percent = percent;
		if (this.control)
			this.control.setProgress(percent, totalTime);
	}

	public finished(): string | undefined {
		this.timer.reset();
		if (this.isLooping) {
			this.timer.start(0);
			this.midiBuffer!.finished();
			this.midiBuffer!.start();
			return "continue";
		} else {
			this.timer.stop();
			if (this.isStarted) {
				if (this.control)
					this.control.pushPlay(false);
				this.isStarted = false;
				this.midiBuffer!.finished();
				if (this.cursorControl && this.cursorControl.onFinished && typeof this.cursorControl.onFinished === 'function')
					this.cursorControl.onFinished();
				this.setProgress(0, 1);
			}
		}
		return undefined;
	}

	public beatCallback(beatNumber: number, totalBeats: number, totalTime: number, position: any): void {
		const percent = beatNumber / totalBeats;
		this.setProgress(percent, totalTime);
		if (this.cursorControl && this.cursorControl.onBeat && typeof this.cursorControl.onBeat === 'function')
			this.cursorControl.onBeat(beatNumber, totalBeats, totalTime, position);
	}

	public eventCallback(event: any): string | undefined {
		if (event) {
			if (this.cursorControl && this.cursorControl.onEvent && typeof this.cursorControl.onEvent === 'function')
				this.cursorControl.onEvent(event);
		} else {
			return this.finished();
		}
		return undefined;
	}

	public lineEndCallback(lineEvent: any, leftEvent: any): void {
		if (this.cursorControl && this.cursorControl.onLineEnd && typeof this.cursorControl.onLineEnd === 'function')
			this.cursorControl.onLineEnd(lineEvent, leftEvent);
	}

	public getUrl(): string {
		return this.midiBuffer ? this.midiBuffer.download() : "";
	}

	public download(fileName?: string): void {
		const url = this.getUrl();
		if (!url) return;
		const link = document.createElement('a');
		document.body.appendChild(link);
		link.setAttribute("style", "display: none;");
		link.href = url;
		link.download = fileName ? fileName : 'output.wav';
		link.click();
		window.URL.revokeObjectURL(url);
		document.body.removeChild(link);
	}
}
