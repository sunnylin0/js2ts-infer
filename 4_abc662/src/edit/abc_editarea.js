// Polyfill for CustomEvent for old IE versions
try {
    if (typeof window !== 'undefined' && typeof window.CustomEvent !== "function") {
        const CustomEventPolyfill = function (event, params) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            const evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            return evt;
        };
        CustomEventPolyfill.prototype = window.Event.prototype;
        window.CustomEvent = CustomEventPolyfill;
    }
}
catch (e) {
    // if we aren't in a browser, this code will crash, but it is not needed then either.
}
export default class EditArea {
    constructor(textareaid) {
        this.isEditArea = true;
        this.isDragging = false;
        this.changelistener = null;
        if (typeof textareaid === "string") {
            let el = document.getElementById(textareaid);
            if (!el)
                el = document.querySelector(textareaid);
            if (!el)
                throw new Error(`EditArea: element not found: ${textareaid}`);
            this.textarea = el;
        }
        else {
            this.textarea = textareaid;
        }
        this.initialText = this.textarea.value;
    }
    addSelectionListener(listener) {
        this.textarea.onmousemove = () => {
            if (this.isDragging)
                listener.fireSelectionChanged();
        };
    }
    addChangeListener(listener) {
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
    getSelection() {
        return { start: this.textarea.selectionStart, end: this.textarea.selectionEnd };
    }
    setSelection(start, end) {
        if (this.textarea.setSelectionRange)
            this.textarea.setSelectionRange(start, end);
        this.textarea.focus();
    }
    getString() {
        return this.textarea.value;
    }
    setString(str) {
        this.textarea.value = str;
        this.initialText = this.getString();
        if (this.changelistener) {
            this.changelistener.fireChanged();
        }
    }
    getElem() {
        return this.textarea;
    }
}
