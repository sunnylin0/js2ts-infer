import supportsAudio from './supports-audio';
import registerAudioContext from './register-audio-context';
import activeAudioContext from './active-audio-context';

// @ts-ignore
import loopImage from './images/loop.svg';
// @ts-ignore
import playImage from './images/play.svg';
// @ts-ignore
import pauseImage from './images/pause.svg';
// @ts-ignore
import loadingImage from './images/loading.svg';
// @ts-ignore
import resetImage from './images/reset.svg';

export default class CreateSynthControl {
	public parent: HTMLElement;
	public options: any;

	constructor(parent: string | HTMLElement, options?: any) {
		if (typeof parent === "string") {
			const selector = parent;
			const element = document.querySelector(selector);
			if (!element || !(element instanceof HTMLElement))
				throw new Error("Cannot find element \"" + selector + "\" in the DOM.");
			this.parent = element;
		} else if (!(parent instanceof HTMLElement))
			throw new Error("The first parameter must be a valid element or selector in the DOM.");
		else
			this.parent = parent;

		this.options = options ? Object.assign({}, options) : {};

		if (this.options.ac)
			registerAudioContext(this.options.ac);
		
		this.buildDom(this.parent, this.options);
		this.attachListeners();

		if (this.options.afterResume) {
			let isResumed = false;
			const ac = this.options.ac || activeAudioContext();
			if (ac) {
				isResumed = ac.state !== "suspended";
			}
			if (isResumed)
				this.options.afterResume();
		}
	}

	public disable(isDisabled: boolean): void {
		const el = this.parent.querySelector(".abcjs-inline-audio");
		if (el) {
			if (isDisabled)
				el.classList.add("abcjs-disabled");
			else
				el.classList.remove("abcjs-disabled");
		}
	}

	public setWarp(tempo: number, warp: number): void {
		const el = this.parent.querySelector(".abcjs-midi-tempo") as HTMLInputElement;
		if (el) el.value = Math.round(warp).toString();
		this.setTempo(tempo);
	}

	public setTempo(tempo: number): void {
		const el = this.parent.querySelector(".abcjs-midi-current-tempo");
		if (el)
			el.innerHTML = Math.round(tempo).toString();
	}

	public resetAll(): void {
		const pushedButtons = this.parent.querySelectorAll(".abcjs-pushed");
		for (let i = 0; i < pushedButtons.length; i++) {
			pushedButtons[i].classList.remove("abcjs-pushed");
		}
	}

	public pushPlay(push: boolean): void {
		const startButton = this.parent.querySelector(".abcjs-midi-start");
		if (!startButton)
			return;
		if (push)
			startButton.classList.add("abcjs-pushed");
		else
			startButton.classList.remove("abcjs-pushed");
	}

	public pushLoop(push: boolean): void {
		const loopButton = this.parent.querySelector(".abcjs-midi-loop");
		if (!loopButton)
			return;
		if (push)
			loopButton.classList.add("abcjs-pushed");
		else
			loopButton.classList.remove("abcjs-pushed");
	}

	public setProgress(percent: number, totalTime: number): void {
		const progressBackground = this.parent.querySelector(".abcjs-midi-progress-background") as HTMLElement;
		const progressThumb = this.parent.querySelector(".abcjs-midi-progress-indicator") as HTMLElement;
		if (!progressBackground || !progressThumb)
			return;
		const width = progressBackground.clientWidth;
		const left = width * percent;
		progressThumb.style.left = left + "px";

		const clock = this.parent.querySelector(".abcjs-midi-clock");
		if (clock) {
			const totalSeconds = (totalTime * percent) / 1000;
			const minutes = Math.floor(totalSeconds / 60);
			const seconds = Math.floor(totalSeconds % 60);
			const secondsFormatted = seconds < 10 ? "0" + seconds : seconds;
			clock.innerHTML = minutes + ":" + secondsFormatted;
		}
	}

	private buildDom(parent: HTMLElement, options: any): void {
		const hasLoop = !!options.loopHandler;
		const hasRestart = !!options.restartHandler;
		const hasPlay = !!options.playHandler || !!options.playPromiseHandler;
		const hasProgress = !!options.progressHandler;
		const hasWarp = !!options.warpHandler;
		const hasClock = options.hasClock !== false;

		let html = '<div class="abcjs-inline-audio">\n';
		if (hasLoop) {
			const repeatTitle = options.repeatTitle ? options.repeatTitle : "Click to toggle play once/repeat.";
			const repeatAria = options.repeatAria ? options.repeatAria : repeatTitle;
			html += `<button type="button" class="abcjs-midi-loop abcjs-btn" title="${repeatTitle}" aria-label="${repeatAria}">${loopImage}</button>\n`;
		}
		if (hasRestart) {
			const restartTitle = options.restartTitle ? options.restartTitle : "Click to go to beginning.";
			const restartAria = options.restartAria ? options.restartAria : restartTitle;
			html += `<button type="button" class="abcjs-midi-reset abcjs-btn" title="${restartTitle}" aria-label="${restartAria}">${resetImage}</button>\n`;
		}
		if (hasPlay) {
			const playTitle = options.playTitle ? options.playTitle : "Click to play/pause.";
			const playAria = options.playAria ? options.playAria : playTitle;
			html += `<button type="button" class="abcjs-midi-start abcjs-btn" title="${playTitle}" aria-label="${playAria}">${playImage}${pauseImage}${loadingImage}</button>\n`;
		}
		if (hasProgress) {
			const randomTitle = options.randomTitle ? options.randomTitle : "Click to change the playback position.";
			const randomAria = options.randomAria ? options.randomAria : randomTitle;
			html += `<button type="button" class="abcjs-midi-progress-background" title="${randomTitle}" aria-label="${randomAria}"><span class="abcjs-midi-progress-indicator"></span></button>\n`;
		}
		if (hasClock) {
			html += '<span class="abcjs-midi-clock"></span>\n';
		}
		if (hasWarp) {
			const warpTitle = options.warpTitle ? options.warpTitle : "Change the playback speed.";
			const warpAria = options.warpAria ? options.warpAria : warpTitle;
			const bpm = options.bpm ? options.bpm : "BPM";
			html += `<span class="abcjs-tempo-wrapper"><label><input class="abcjs-midi-tempo" type="number" min="1" max="300" value="100" title="${warpTitle}" aria-label="${warpAria}">%</label><span>&nbsp;(<span class="abcjs-midi-current-tempo"></span> ${bpm})</span></span>\n`;
		}
		html += '<div class="abcjs-css-warning" style="font-size: 12px;color:red;border: 1px solid red;text-align: center;width: 300px;margin-top: 4px;font-weight: bold;border-radius: 4px;">CSS required: load abcjs-audio.css</div>';
		html += '</div>\n';
		parent.innerHTML = html;
	}

	private attachListeners(): void {
		const playBtn = this.parent.querySelector(".abcjs-midi-start") as HTMLElement;

		const wrap = (handler: any, isPromise?: boolean) => {
			return (ev: Event) => this.acResumerMiddleWare(handler, ev, playBtn, this.options.afterResume, isPromise);
		};

		if (this.options.loopHandler)
			this.parent.querySelector(".abcjs-midi-loop")?.addEventListener("click", wrap(this.options.loopHandler));
		if (this.options.restartHandler)
			this.parent.querySelector(".abcjs-midi-reset")?.addEventListener("click", wrap(this.options.restartHandler));
		if (this.options.playPromiseHandler || this.options.playHandler)
			playBtn?.addEventListener("click", wrap(this.options.playPromiseHandler || this.options.playHandler, !!this.options.playPromiseHandler));
		if (this.options.progressHandler)
			this.parent.querySelector(".abcjs-midi-progress-background")?.addEventListener("click", wrap(this.options.progressHandler));
		if (this.options.warpHandler)
			this.parent.querySelector(".abcjs-midi-tempo")?.addEventListener("change", wrap(this.options.warpHandler));
	}

	private acResumerMiddleWare(next: any, ev: Event, playBtn: HTMLElement | null, afterResume: any, isPromise?: boolean): void {
		let needsInit = true;
		if (!activeAudioContext()) {
			registerAudioContext();
		} else {
			needsInit = activeAudioContext()!.state === "suspended";
		}
		if (!supportsAudio()) {
			throw { status: "NotSupported", message: "This browser does not support audio." };
		}

		if ((needsInit || isPromise) && playBtn)
			playBtn.classList.add("abcjs-loading");

		const doNext = () => {
			if (isPromise) {
				next(ev).then(() => {
					if (playBtn) playBtn.classList.remove("abcjs-loading");
				});
			} else {
				next(ev);
				if (playBtn) playBtn.classList.remove("abcjs-loading");
			}
		};

		if (needsInit) {
			activeAudioContext()!.resume().then(() => {
				if (afterResume) {
					afterResume().then(() => doNext());
				} else {
					doNext();
				}
			});
		} else {
			doNext();
		}
	}
}
