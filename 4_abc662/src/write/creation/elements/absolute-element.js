import highlight from "../../interactive/highlight";
import unhighlight from "../../interactive/unhighlight";
class AbsoluteElement {
    constructor(abcelem, duration, minspacing, type, tuneNumber, options = {}) {
        this.x = 0;
        this.children = [];
        this.heads = [];
        this.extra = [];
        this.extraw = 0;
        this.w = 0;
        this.right = [];
        this.invisible = false;
        this.elemset = [];
        this.fixed = { w: 0, t: undefined, b: undefined };
        this.specialY = {
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
    addExtra(extra) {
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
    addHead(head) {
        if (head.dx < this.extraw)
            this.extraw = head.dx;
        this.heads.push(head);
        this.addRight(head);
    }
    addRight(right) {
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
    addFixed(elem) {
        this._addChild(elem);
    }
    addFixedX(elem) {
        this._addChild(elem);
    }
    addCentered(elem) {
        const half = elem.w / 2;
        if (-half < this.extraw)
            this.extraw = -half;
        this.extra.push(elem);
        if (elem.dx + half > this.w)
            this.w = elem.dx + half;
        this.right.push(elem);
        this._addChild(elem);
    }
    setLimit(member, child) {
        if (!child[member])
            return;
        if (!this.specialY[member])
            this.specialY[member] = child[member];
        else
            this.specialY[member] = Math.max(this.specialY[member], child[member]);
    }
    _addChild(child) {
        let okToPushTop = true;
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
    pushTop(top) {
        if (top !== undefined) {
            if (this.top === undefined)
                this.top = top;
            else
                this.top = Math.max(top, this.top);
        }
    }
    pushBottom(bottom) {
        if (bottom !== undefined) {
            if (this.bottom === undefined)
                this.bottom = bottom;
            else
                this.bottom = Math.min(bottom, this.bottom);
        }
    }
    setX(x) {
        this.x = x;
        for (let i = 0; i < this.children.length; i++)
            this.children[i].setX(x);
    }
    center(before, after) {
        const midpoint = (after.x - before.x) / 2 + before.x;
        this.x = midpoint - this.w / 2;
        for (let k = 0; k < this.children.length; k++)
            this.children[k].setX(this.x);
    }
    setHint() {
        this.hint = true;
    }
    highlight(klass, color) {
        highlight.bind(this)(klass, color);
    }
    unhighlight(klass, color) {
        unhighlight.bind(this)(klass, color);
    }
}
export default AbsoluteElement;
