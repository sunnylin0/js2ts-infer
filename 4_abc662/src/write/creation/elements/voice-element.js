class VoiceElement {
    constructor(voicenumber, voicetotal) {
        this.children = [];
        this.beams = [];
        this.otherchildren = []; // ties, slurs, triplets
        this.w = 0;
        this.duplicate = false;
        this.bottom = 7;
        this.top = 7;
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
        this.voicenumber = voicenumber;
        this.voicetotal = voicetotal;
        this.bottom = 7;
        this.top = 7;
    }
    addChild(absElem) {
        if (absElem.type === 'bar') {
            let firstItem = true;
            for (let i = 0; firstItem && i < this.children.length; i++) {
                if (this.children[i].type.indexOf("staff-extra") < 0 && this.children[i].type !== "tempo")
                    firstItem = false;
            }
            if (!firstItem) {
                this.beams.push("bar");
                this.otherchildren.push("bar");
            }
        }
        this.children.push(absElem);
        this.setRange(absElem);
    }
    setLimit(member, child) {
        let specialY = child.specialY;
        if (!specialY)
            specialY = child;
        if (!specialY[member])
            return;
        if (!this.specialY[member])
            this.specialY[member] = specialY[member];
        else
            this.specialY[member] = Math.max(this.specialY[member], specialY[member]);
    }
    adjustRange(child) {
        if (child.bottom !== undefined)
            this.bottom = Math.min(this.bottom, child.bottom);
        if (child.top !== undefined)
            this.top = Math.max(this.top, child.top);
    }
    setRange(child) {
        this.adjustRange(child);
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
    addOther(child) {
        this.otherchildren.push(child);
        this.setRange(child);
    }
    addBeam(child) {
        this.beams.push(child);
    }
    setWidth(width) {
        this.w = width;
    }
}
export default VoiceElement;
