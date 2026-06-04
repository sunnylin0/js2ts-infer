class CrescendoElem {
    constructor(anchor1, anchor2, dir, positioning) {
        this.type = "CrescendoElem";
        this.anchor1 = anchor1;
        this.anchor2 = anchor2;
        this.dir = dir;
        if (positioning === 'above')
            this.dynamicHeightAbove = 6;
        else
            this.dynamicHeightBelow = 6;
        this.pitch = undefined;
    }
}
export default CrescendoElem;
