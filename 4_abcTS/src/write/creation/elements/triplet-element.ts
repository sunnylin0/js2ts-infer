class TripletElem {
    endingHeightAbove: any;
    anchor2: any;
    flatBeams: any;
    durationClass: any;
    number: any;
    anchor1: any;
    type = "TripletElem";
    middleElems = [];

    constructor(number: number, anchor1: RelativeElement, options: any = {}) {
        this.anchor1 = anchor1;
        this.number = number;
        const duration: number = anchor1.parent ? anchor1.parent.durationClass : 1;
        this.durationClass = ('d' + (Math.round(duration * 1000) / 1000)).replace(/\./, '-');
        this.flatBeams = options.flatBeams;
    }
    isClosed(): boolean {
        return !!this.anchor2;
    }
    middleNote(elem: RelativeElement): void {
        this.middleElems.push(elem);
    }
    setCloseAnchor(anchor2: RelativeElement): void {
        this.anchor2 = anchor2;
        const parent: AbsoluteElement = this.anchor1.parent;
        if (!parent || !parent.beam || this.anchor1.stemDir === 'up')
            this.endingHeightAbove = 4;
    }
}
export default TripletElem;
