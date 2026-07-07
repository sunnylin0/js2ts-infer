class CrescendoElem {
    dynamicHeightBelow: any;
    dynamicHeightAbove: any;
    dir: any;
    anchor2: any;
    anchor1: any;
    type = "CrescendoElem";
    pitch = undefined;

    constructor(anchor1, anchor2, dir, positioning) {
        this.anchor1 = anchor1;
        this.anchor2 = anchor2;
        this.dir = dir;
        if (positioning === 'above')
            this.dynamicHeightAbove = 6;
        else
            this.dynamicHeightBelow = 6;
    }
}
export default CrescendoElem;
