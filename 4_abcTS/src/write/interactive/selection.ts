import spacing from '../helpers/spacing';
import createAnalysis from './create-analysis';
function setupSelection(engraver: EngraverController, svgs: Array<SVGSVGElement>): void {
    engraver.rangeHighlight = rangeHighlight.bind(engraver);
    if (engraver.dragging) {
        for (let h: number = 0; h < engraver.selectables.length; h++) {
            const hist: Selectables = engraver.selectables[h];
            if (hist.svgEl.getAttribute("selectable") === "true") {
                hist.svgEl.setAttribute("tabindex", "0");
                hist.svgEl.setAttribute("data-index", h.toString());
                hist.svgEl.addEventListener("keydown", keyboardDown.bind(engraver));
                hist.svgEl.addEventListener("keyup", keyboardSelection.bind(engraver));
                hist.svgEl.addEventListener("focus", elementFocused.bind(engraver));
            }
        }
    }
    for (let i: number = 0; i < svgs.length; i++) {
        svgs[i].addEventListener('touchstart', mouseDown.bind(engraver), { passive: true });
        svgs[i].addEventListener('touchmove', mouseMove.bind(engraver), { passive: true });
        svgs[i].addEventListener('touchend', mouseUp.bind(engraver), { passive: true });
        svgs[i].addEventListener('mousedown', mouseDown.bind(engraver));
        svgs[i].addEventListener('mousemove', mouseMove.bind(engraver));
        svgs[i].addEventListener('mouseup', mouseUp.bind(engraver));
    }
}
function getCoord(ev: /* @inferred-low-confidence */ MouseEvent): any[] {
    let scaleX: number = 1;
    let scaleY: number = 1;
    const svg = ev.target.closest('svg');
    let yOffset: number = 0;
    if (svg && svg.viewBox && svg.viewBox.baseVal) {
        if (svg.viewBox.baseVal.width !== 0)
            scaleX = svg.viewBox.baseVal.width / svg.clientWidth;
        if (svg.viewBox.baseVal.height !== 0)
            scaleY = svg.viewBox.baseVal.height / svg.clientHeight;
        yOffset = svg.viewBox.baseVal.y;
    }
    const svgClicked: boolean = ev.target && ev.target.tagName === "svg";
    let x;
    let y;
    if (svgClicked) {
        x = ev.offsetX;
        y = ev.offsetY;
    }
    else {
        x = ev.layerX;
        y = ev.layerY;
    }
    x = x * scaleX;
    y = y * scaleY;
    return [x, y + yOffset];
}
function elementFocused(ev): void {
    if (this.dragMechanism === "keyboard" && this.dragYStep !== 0 && this.dragTarget)
        notifySelect.call(this, this.dragTarget, this.dragYStep, this.selectables.length, this.dragIndex, ev);
    this.dragYStep = 0;
}
function keyboardDown(ev): void {
    switch (ev.keyCode) {
        case 38:
        case 40:
            ev.preventDefault();
    }
}
function keyboardSelection(ev): void {
    let handled: boolean = false;
    const index = ev.target.dataset.index;
    switch (ev.keyCode) {
        case 13:
        case 32:
            handled = true;
            this.dragTarget = this.selectables[index];
            this.dragIndex = index;
            this.dragMechanism = "keyboard";
            mouseUp.call(this, ev);
            break;
        case 38: // arrow up
            handled = true;
            this.dragTarget = this.selectables[index];
            this.dragIndex = index;
            if (this.dragTarget && this.dragTarget.isDraggable) {
                if (this.dragging && this.dragTarget.isDraggable)
                    this.dragTarget.absEl.highlight(undefined, this.dragColor);
                this.dragYStep--;
                this.dragTarget.svgEl.setAttribute("transform", "translate(0," + (this.dragYStep * spacing.STEP) + ")");
            }
            break;
        case 40: // arrow down
            handled = true;
            this.dragTarget = this.selectables[index];
            this.dragIndex = index;
            this.dragMechanism = "keyboard";
            if (this.dragTarget && this.dragTarget.isDraggable) {
                if (this.dragging && this.dragTarget.isDraggable)
                    this.dragTarget.absEl.highlight(undefined, this.dragColor);
                this.dragYStep++;
                this.dragTarget.svgEl.setAttribute("transform", "translate(0," + (this.dragYStep * spacing.STEP) + ")");
            }
            break;
        case 9: // tab
            if (this.dragYStep !== 0) {
                mouseUp.call(this, ev);
            }
            break;
    }
    if (handled)
        ev.preventDefault();
}
function findElementInHistory(selectables: /* @inferred-low-confidence */ any, el: /* @inferred-low-confidence */ EventTarget): number {
    if (!el)
        return -1;
    const dataset = el.dataset;
    if (!dataset)
        return -1;
    const index = dataset.index;
    for (let i: number = 0; i < selectables.length; i++) {
        const svgDataset: DOMStringMap = selectables[i].svgEl.dataset;
        if (svgDataset && index === svgDataset.index)
            return i;
    }
    return -1;
}
function findElementByCoord(self: /* @inferred-low-confidence */ any, x: /* @inferred-low-confidence */ any, y: /* @inferred-low-confidence */ any): number {
    let minDistance: number = 9999999;
    let closestIndex: number = -1;
    for (let i: number = 0; i < self.selectables.length && minDistance > 0; i++) {
        const el = self.selectables[i];
        self.getDim(el);
        if (el.dim.left < x && el.dim.right > x && el.dim.top < y && el.dim.bottom > y) {
            closestIndex = i;
            minDistance = 0;
        }
        else if (el.dim.top < y && el.dim.bottom > y) {
            const horiz: number = Math.min(Math.abs(el.dim.left - x), Math.abs(el.dim.right - x));
            if (horiz < minDistance) {
                minDistance = horiz;
                closestIndex = i;
            }
        }
        else if (el.dim.left < x && el.dim.right > x) {
            const vert: number = Math.min(Math.abs(el.dim.top - y), Math.abs(el.dim.bottom - y));
            if (vert < minDistance) {
                minDistance = vert;
                closestIndex = i;
            }
        }
        else {
            const dx: number = Math.abs(x - el.dim.left) > Math.abs(x - el.dim.right) ? Math.abs(x - el.dim.right) : Math.abs(x - el.dim.left);
            const dy: number = Math.abs(y - el.dim.top) > Math.abs(y - el.dim.bottom) ? Math.abs(y - el.dim.bottom) : Math.abs(y - el.dim.top);
            const hypotenuse: number = Math.sqrt(dx * dx + dy * dy);
            if (hypotenuse < minDistance) {
                minDistance = hypotenuse;
                closestIndex = i;
            }
        }
    }
    return (closestIndex >= 0 && minDistance <= 12) ? closestIndex : -1;
}
function getBestMatchCoordinates(dim, ev: MouseEvent, scale): any[] {
    if (dim.x <= ev.offsetX && dim.x + dim.width >= ev.offsetX &&
        dim.y <= ev.offsetY && dim.y + dim.height >= ev.offsetY)
        return [ev.offsetX, ev.offsetY];
    const epsilon: number = Math.abs(ev.layerY / scale - ev.offsetY);
    if (epsilon < 3)
        return [ev.offsetX, ev.offsetY];
    else
        return [ev.layerX, ev.layerY];
}
function getTarget(target: /* @inferred-low-confidence */ EventTarget): EventTarget {
    if (!target)
        return null;
    if (target.tagName === "svg")
        return target;
    if (!target.getAttribute)
        return null;
    let found = target.getAttribute("selectable");
    while (!found) {
        if (!target.parentElement)
            found = true;
        else {
            target = target.parentElement;
            if (target.tagName === "svg")
                found = true;
            else
                found = target.getAttribute("selectable");
        }
    }
    return target;
}
function getMousePosition(self: /* @inferred-low-confidence */ any, ev: /* @inferred-low-confidence */ MouseEvent) {
    let x;
    let y;
    let box;
    let clickedOn: number = findElementInHistory(self.selectables, getTarget(ev.target));
    if (clickedOn >= 0) {
        box = getBestMatchCoordinates(self.selectables[clickedOn].svgEl.getBBox(), ev, self.scale);
        x = box[0];
        y = box[1];
    }
    else {
        const coords: any[] = getCoord(ev);
        x = coords[0];
        y = coords[1];
        clickedOn = findElementByCoord(self, x, y);
    }
    return { x: x, y: y, clickedOn: clickedOn };
}
function attachMissingTouchEventAttributes(touchEv: MouseEvent): void {
    if (!touchEv || !touchEv.target || !touchEv.touches || touchEv.touches.length < 1)
        return;
    const rect = touchEv.target.getBoundingClientRect();
    const offsetX: number = touchEv.touches[0].pageX - rect.left;
    const offsetY: number = touchEv.touches[0].pageY - rect.top;
    touchEv.touches[0].offsetX = offsetX;
    touchEv.touches[0].offsetY = offsetY;
    touchEv.touches[0].layerX = touchEv.touches[0].pageX;
    touchEv.touches[0].layerY = touchEv.touches[0].pageY;
}
function mouseDown(ev: /* @inferred-low-confidence */ any): void {
    let _ev = ev;
    if (ev.type === 'touchstart') {
        attachMissingTouchEventAttributes(ev);
        if (ev.touches.length > 0)
            _ev = ev.touches[0];
    }
    const positioning = getMousePosition(this, _ev);
    if (positioning.clickedOn >= 0 && (ev.type === 'touchstart' || ev.button === 0) && this.selectables[positioning.clickedOn]) {
        this.dragTarget = this.selectables[positioning.clickedOn];
        this.dragIndex = positioning.clickedOn;
        this.dragMechanism = "mouse";
        this.dragMouseStart = { x: positioning.x, y: positioning.y };
        if (this.dragging && this.dragTarget.isDraggable) {
            addGlobalClass(this.renderer.paper, "abcjs-dragging-in-progress");
            this.dragTarget.absEl.highlight(undefined, this.dragColor);
        }
    }
}
function mouseMove(ev: MouseEvent): void {
    let _ev: MouseEvent = ev;
    if (ev.type === 'touchmove') {
        attachMissingTouchEventAttributes(ev);
        if (ev.touches.length > 0)
            _ev = ev.touches[0];
    }
    this.lastTouchMove = ev;
    if (!this.dragTarget || !this.dragging || !this.dragTarget.isDraggable || this.dragMechanism !== 'mouse' || !this.dragMouseStart)
        return;
    const positioning = getMousePosition(this, _ev);
    const yDist: number = Math.round((positioning.y - this.dragMouseStart.y) / spacing.STEP);
    if (yDist !== this.dragYStep) {
        this.dragYStep = yDist;
        this.dragTarget.svgEl.setAttribute("transform", "translate(0," + (yDist * spacing.STEP) + ")");
    }
}
function mouseUp(ev: /* @inferred-low-confidence */ any): void {
    let _ev = ev;
    if (ev.type === 'touchend' && this.lastTouchMove) {
        attachMissingTouchEventAttributes(this.lastTouchMove);
        if (this.lastTouchMove && this.lastTouchMove.touches && this.lastTouchMove.touches.length > 0)
            _ev = this.lastTouchMove.touches[0];
    }
    if (!this.dragTarget)
        return;
    clearSelection.call(this);
    if (this.dragTarget.absEl && this.dragTarget.absEl.highlight) {
        this.selected = [this.dragTarget.absEl];
        this.dragTarget.absEl.highlight(undefined, this.selectionColor);
    }
    notifySelect.call(this, this.dragTarget, this.dragYStep, this.selectables.length, this.dragIndex, _ev);
    if (this.dragTarget.svgEl && this.dragTarget.svgEl.focus) {
        this.dragTarget.svgEl.focus();
        this.dragTarget = null;
        this.dragIndex = -1;
    }
    removeGlobalClass(this.renderer.svg, "abcjs-dragging-in-progress");
}
function setSelection(dragIndex): void {
    if (dragIndex >= 0 && dragIndex < this.selectables.length) {
        this.dragTarget = this.selectables[dragIndex];
        this.dragIndex = dragIndex;
        this.dragMechanism = "keyboard";
        mouseUp.call(this, { target: this.dragTarget.svgEl });
    }
}
function notifySelect(target, dragStep, dragMax, dragIndex, ev): void {
    const ret = createAnalysis(target, ev);
    const classes: any[] = ret.classes;
    const analysis: {} = ret.analysis;
    for (let i: number = 0; i < this.listeners.length; i++) {
        this.listeners[i](target.absEl.abcelem, target.absEl.tuneNumber, classes.join(' '), analysis, { step: dragStep, max: dragMax, index: dragIndex, setSelection: setSelection.bind(this) }, ev);
    }
}
function clearSelection(): void {
    for (let i: number = 0; i < this.selected.length; i++) {
        this.selected[i].unhighlight(undefined, this.renderer.foregroundColor);
    }
    this.selected = [];
}
function rangeHighlight(start: number, end: number): void {
    clearSelection.call(this);
    for (let line: number = 0; line < this.staffgroups.length; line++) {
        const voices: Array<VoiceElement> = this.staffgroups[line].voices;
        for (let voice: number = 0; voice < voices.length; voice++) {
            const elems: Array<AbsoluteElement> = voices[voice].children;
            for (let elem: number = 0; elem < elems.length; elem++) {
                const elStart: number = elems[elem].abcelem.startChar;
                const elEnd: number = elems[elem].abcelem.endChar;
                if ((end > elStart && start < elEnd) || ((end === start) && end === elEnd)) {
                    this.selected.push(elems[elem]);
                    elems[elem].highlight(undefined, this.selectionColor);
                }
            }
        }
    }
}
function getClassSet(el): {} {
    const oldClass = el.getAttribute('class');
    if (!oldClass)
        return {};
    const klasses = oldClass.split(" ");
    const obj: {} = {};
    for (let i: number = 0; i < klasses.length; i++)
        if (klasses[i].length > 0)
            obj[klasses[i]] = true;
    return obj;
}
function setClassSet(el, klassSet): void {
    const klasses = [];
    for (const key in klassSet) {
        if (Object.prototype.hasOwnProperty.call(klassSet, key))
            klasses.push(key);
    }
    el.setAttribute('class', klasses.join(' '));
}
function addGlobalClass(svg, klass: string): void {
    if (svg && svg.svg) {
        const obj: {} = getClassSet(svg.svg);
        obj[klass] = true;
        setClassSet(svg.svg, obj);
    }
}
function removeGlobalClass(svg, klass: string): void {
    if (svg && svg.svg) {
        const obj: {} = getClassSet(svg.svg);
        delete obj[klass];
        setClassSet(svg.svg, obj);
    }
}
export default setupSelection;
