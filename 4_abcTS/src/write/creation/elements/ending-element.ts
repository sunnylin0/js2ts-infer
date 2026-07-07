class EndingElem {
    anchor2: any;
    anchor1: any;
    text: any;
    type = "EndingElem";
    endingHeightAbove = 5;
    pitch = undefined;

    constructor(text: string, anchor1: RelativeElement, anchor2: any) {
        this.text = text;
        this.anchor1 = anchor1;
        this.anchor2 = anchor2;
    }
}
export default EndingElem;
