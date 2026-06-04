class TripletElem {
    constructor(number, anchor1, options = {}) {
        this.type = "TripletElem";
        this.middleElems = [];
        this.anchor1 = anchor1;
        this.number = number;
        const duration = anchor1.parent ? anchor1.parent.durationClass : 1;
        this.durationClass = ('d' + (Math.round(duration * 1000) / 1000)).replace(/\./, '-');
        this.middleElems = [];
        this.flatBeams = options.flatBeams;
    }
    isClosed() {
        return !!this.anchor2;
    }
    middleNote(elem) {
        this.middleElems.push(elem);
    }
    setCloseAnchor(anchor2) {
        this.anchor2 = anchor2;
        const parent = this.anchor1.parent;
        if (!parent || !parent.beam || this.anchor1.stemDir === 'up')
            this.endingHeightAbove = 4;
    }
}
export default TripletElem;
