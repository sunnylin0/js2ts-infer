import highlight from "../../interactive/highlight";
import unhighlight from "../../interactive/unhighlight";
class AbsoluteElement {
    hint: any;
    bottom: number;
    top: number;
    type: string;
    minspacing: number;
    durationClass: number;
    duration: number;
    abcelem: Abcelem;
    tuneNumber: number;
    x: number = 0;
    children: RelativeElement[] = [];
    heads: RelativeElement[] = [];
    extra: RelativeElement[] = [];
    extraw: number = 0;
    w: number = 0;
    right: RelativeElement[] = [];
    invisible: boolean = false;
    elemset: SVGGElement[] = [];
    fixed: Fixed = { w: 0, t: undefined, b: undefined };
    specialY: SpecialY = {
                    tempoHeightAbove: 0,
                    partHeightAbove: 0,
                    volumeHeightAbove: 0,
                    dynamicHeightAbove: 0,
                    endingHeightAbove: 0,
                    chordHeightAbove: 0,
                    lyricHeightAbove: 0,
                    lyricHeightBelow: 0,
                    chordHeightBelow: 0,
                    volumeHeightBelow: 0,
                    dynamicHeightBelow: 0
                };

    constructor(abcelem: any, duration: number, minspacing: number, type: string, tuneNumber: number, options: any = {}) {
        this.tuneNumber = tuneNumber;
        this.abcelem = abcelem;
        this.duration = duration;
        this.durationClass = options.durationClassOveride !== undefined ? options.durationClassOveride : this.duration;
        this.minspacing = minspacing || 0;
        this.type = type;
    }
    getFixedCoords() {
        return { x: this.x, w: this.fixed.w, t: this.fixed.t, b: this.fixed.b };
    }
    addExtra(extra: RelativeElement): void {
        this.fixed.w = Math.max(this.fixed.w, extra.dx + extra.w);
        if (this.fixed.t === undefined)
            this.fixed.t = extra.top;
        else
            this.fixed.t = Math.max(this.fixed.t, extra.top);
        if (this.fixed.b === undefined)
            this.fixed.b = extra.bottom;
        else
            this.fixed.b = Math.min(this.fixed.b, extra.bottom);
        if (extra.dx < this.extraw)
            this.extraw = extra.dx;
        this.extra.push(extra);
        this._addChild(extra);
    }
    addHead(head: RelativeElement): void {
        if (head.dx < this.extraw)
            this.extraw = head.dx;
        this.heads.push(head);
        this.addRight(head);
    }
    addRight(right: RelativeElement): void {
        this.fixed.w = Math.max(this.fixed.w, right.dx + right.w);
        if (right.top !== undefined) {
            if (this.fixed.t === undefined)
                this.fixed.t = right.top;
            else
                this.fixed.t = Math.max(this.fixed.t, right.top);
        }
        if (right.bottom !== undefined) {
            if (this.fixed.b === undefined)
                this.fixed.b = right.bottom;
            else
                this.fixed.b = Math.min(this.fixed.b, right.bottom);
        }
        if (right.dx + right.w > this.w)
            this.w = right.dx + right.w;
        this.right.push(right);
        this._addChild(right);
    }
    addFixed(elem: RelativeElement): void {
        this._addChild(elem);
    }
    addFixedX(elem: RelativeElement | TempoElement): void {
        this._addChild(elem);
    }
    addCentered(elem: RelativeElement): void {
        const half: number = elem.w / 2;
        if (-half < this.extraw)
            this.extraw = -half;
        this.extra.push(elem);
        if (elem.dx + half > this.w)
            this.w = elem.dx + half;
        this.right.push(elem);
        this._addChild(elem);
    }
    setLimit(member: string, child: RelativeElement | TempoElement): void {
        if (!child[member])
            return;
        if (!this.specialY[member])
            this.specialY[member] = child[member];
        else
            this.specialY[member] = Math.max(this.specialY[member], child[member]);
    }
    _addChild(child: RelativeElement | TempoElement): void {
        let okToPushTop: boolean = true;
        if ((this.abcelem.el_type == "clef") && (child.type == "barNumber")) {
            okToPushTop = false;
        }
        child.parent = this;
        this.children.push(child);
        if (okToPushTop) {
            this.pushTop(child.top);
        }
        this.pushBottom(child.bottom);
        this.setLimit('tempoHeightAbove', child);
        this.setLimit('partHeightAbove', child);
        this.setLimit('volumeHeightAbove', child);
        this.setLimit('dynamicHeightAbove', child);
        this.setLimit('endingHeightAbove', child);
        this.setLimit('chordHeightAbove', child);
        this.setLimit('lyricHeightAbove', child);
        this.setLimit('lyricHeightBelow', child);
        this.setLimit('chordHeightBelow', child);
        this.setLimit('volumeHeightBelow', child);
        this.setLimit('dynamicHeightBelow', child);
    }
    pushTop(top: number): void {
        if (top !== undefined) {
            if (this.top === undefined)
                this.top = top;
            else
                this.top = Math.max(top, this.top);
        }
    }
    pushBottom(bottom: number): void {
        if (bottom !== undefined) {
            if (this.bottom === undefined)
                this.bottom = bottom;
            else
                this.bottom = Math.min(bottom, this.bottom);
        }
    }
    setX(x: number): void {
        this.x = x;
        for (let i: number = 0; i < this.children.length; i++)
            this.children[i].setX(x);
    }
    center(before: AbsoluteElement, after: AbsoluteElement): void {
        const midpoint: number = (after.x - before.x) / 2 + before.x;
        this.x = midpoint - this.w / 2;
        for (let k: number = 0; k < this.children.length; k++)
            this.children[k].setX(this.x);
    }
    setHint(): void {
        this.hint = true;
    }
    highlight(klass: any, color: string): void {
        highlight.bind(this)(klass, color);
    }
    unhighlight(klass: any, color: string): void {
        unhighlight.bind(this)(klass, color);
    }
}
export default AbsoluteElement;
