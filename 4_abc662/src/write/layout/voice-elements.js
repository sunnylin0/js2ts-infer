class VoiceElement {
    static beginLayout(startx, voice) {
        voice.i = 0;
        voice.durationindex = 0;
        voice.startx = startx;
        voice.minx = startx; // furthest left to where negatively positioned elements are allowed to go
        voice.nextx = startx; // x position where the next element of this voice should be placed assuming no other voices and no fixed width constraints
        voice.spacingduration = 0; // duration left to be laid out in current iteration
    }
    static layoutEnded(voice) {
        return (voice.i >= voice.children.length);
    }
    static getNextX(voice) {
        return Math.max(voice.minx, voice.nextx);
    }
    static getSpacingUnits(voice) {
        return Math.sqrt(voice.spacingduration * 8);
    }
    static layoutOneItem(x, spacing, voice, minPadding, firstVoice) {
        const child = voice.children[voice.i];
        if (!child)
            return 0;
        const er = x - voice.minx; // available extrawidth to the left
        const pad = voice.durationindex + child.duration > 0 ? minPadding : 0; // only add padding to the items that aren't fixed to the left edge.
        // Cross-voice collision detection (per-voice head sharing and shifting)
        if (child.abcelem.el_type === "note" && !child.abcelem.rest && voice.voicenumber !== 0 && firstVoice) {
            const firstChild = firstVoice.children[firstVoice.i];
            let overlaps = firstChild &&
                ((child.abcelem.maxpitch <= firstChild.abcelem.maxpitch + 1 && child.abcelem.maxpitch >= firstChild.abcelem.minpitch - 1) ||
                    (child.abcelem.minpitch <= firstChild.abcelem.maxpitch + 1 && child.abcelem.minpitch >= firstChild.abcelem.minpitch - 1));
            if (overlaps && child.abcelem.minpitch === firstChild.abcelem.minpitch && child.abcelem.maxpitch === firstChild.abcelem.maxpitch &&
                firstChild.heads && firstChild.heads.length > 0 && child.heads && child.heads.length > 0 &&
                firstChild.heads[0].c === child.heads[0].c)
                overlaps = false;
            if (overlaps) {
                const firstChildNoteWidth = firstChild.heads && firstChild.heads.length > 0 ? firstChild.heads[0].realWidth : firstChild.fixed.w;
                if (!child.adjustedWidth)
                    child.adjustedWidth = firstChildNoteWidth + child.w;
                child.w = child.adjustedWidth;
                for (let j = 0; j < child.children.length; j++) {
                    const relativeChild = child.children[j];
                    if (relativeChild.name.indexOf("accidental") < 0) {
                        if (!relativeChild.adjustedWidth)
                            relativeChild.adjustedWidth = relativeChild.dx + firstChildNoteWidth;
                        relativeChild.dx = relativeChild.adjustedWidth;
                    }
                }
            }
        }
        const extraWidth = getExtraWidth(child, pad);
        if (er < extraWidth) { // shift right by needed amount
            if (voice.i === 0 || child.type !== 'bar' || (voice.children[voice.i - 1].type !== 'part' && voice.children[voice.i - 1].type !== 'tempo'))
                x += extraWidth - er;
        }
        child.setX(x);
        voice.spacingduration = child.duration;
        voice.minx = x + getMinWidth(child); // add necessary layout space
        if (voice.i !== voice.children.length - 1)
            voice.minx += child.minspacing; // add minimumspacing except on last elem
        this.updateNextX(x, spacing, voice);
        return x;
    }
    static shiftRight(dx, voice) {
        const child = voice.children[voice.i];
        if (!child)
            return;
        child.setX(child.x + dx);
        voice.minx += dx;
        voice.nextx += dx;
    }
    static updateNextX(x, spacing, voice) {
        voice.nextx = x + (spacing * this.getSpacingUnits(voice));
    }
    static updateIndices(voice) {
        if (!this.layoutEnded(voice)) {
            voice.durationindex += voice.children[voice.i].duration;
            if (voice.children[voice.i].type === 'bar')
                voice.durationindex = Math.round(voice.durationindex * 64) / 64;
            voice.i++;
        }
    }
}
function getExtraWidth(child, minPadding) {
    let padding = 0;
    if (child.type === 'note' || child.type === 'bar')
        padding = minPadding;
    return -child.extraw + padding;
}
function getMinWidth(child) {
    return child.w;
}
export default VoiceElement;
