// Polyfill for CustomEvent for old IE versions
try {
	if (typeof window !== 'undefined' && typeof window.CustomEvent !== "function") {
		const CustomEventPolyfill = function (event: string, params: any) {
			params = params || { bubbles: false, cancelable: false, detail: undefined };
			const evt = document.createEvent('CustomEvent');
			evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
			return evt;
		};
		CustomEventPolyfill.prototype = window.Event.prototype;
		(window as any).CustomEvent = CustomEventPolyfill;
	}
} catch (e) {
	// if we aren't in a browser, this code will crash, but it is not needed then either.
}

export interface SelectionListener {
	fireSelectionChanged(): void;
}

export interface ChangeListener extends SelectionListener {
	fireChanged(): void;
}

export default class EditArea {
	public isEditArea = true;
	public textarea: HTMLTextAreaElement;
	public initialText: string;
	public isDragging = false;
	private changelistener: ChangeListener | null = null;

	constructor(textareaid: string | HTMLTextAreaElement) {
		if (typeof textareaid === "string") {
			let el = document.getElementById(textareaid) as HTMLTextAreaElement;
			if (!el) el = document.querySelector(textareaid) as HTMLTextAreaElement;
			if (!el) throw new Error(`EditArea: element not found: ${textareaid}`);
			this.textarea = el;
		} else {
			this.textarea = textareaid;
		}
		this.initialText = this.textarea.value;
	}

	public addSelectionListener(listener: SelectionListener): void {
		this.textarea.onmousemove = () => {
			if (this.isDragging)
				listener.fireSelectionChanged();
		};
	}

	public addChangeListener(listener: ChangeListener): void {
		this.changelistener = listener;
		this.textarea.onkeyup = () => {
			listener.fireChanged();
		};
		this.textarea.onmousedown = () => {
			this.isDragging = true;
			listener.fireSelectionChanged();
		};
		this.textarea.onmouseup = () => {
			this.isDragging = false;
			listener.fireChanged();
		};
		this.textarea.onchange = () => {
			listener.fireChanged();
		};
	}

	public getSelection(): { start: number; end: number } {
		return { start: this.textarea.selectionStart, end: this.textarea.selectionEnd };
	}

	public setSelection(start: number, end: number): void {
		if (this.textarea.setSelectionRange)
			this.textarea.setSelectionRange(start, end);
		this.textarea.focus();
	}

	public getString(): string {
		return this.textarea.value;
	}

	public setString(str: string): void {
		this.textarea.value = str;
		this.initialText = this.getString();
		if (this.changelistener) {
			this.changelistener.fireChanged();
		}
	}

	public getElem(): HTMLTextAreaElement {
		return this.textarea;
	}
}
