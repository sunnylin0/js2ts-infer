class DynamicDecoration {
    constructor(anchor, dec, position) {
        this.type = "DynamicDecoration";
        this.anchor = anchor;
        this.dec = dec;
        if (position === 'below')
            this.volumeHeightBelow = 6;
        else
            this.volumeHeightAbove = 6;
        this.pitch = undefined;
    }
}
export default DynamicDecoration;
