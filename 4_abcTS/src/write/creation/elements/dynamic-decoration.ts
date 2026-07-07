class DynamicDecoration {
    volumeHeightAbove: any;
    volumeHeightBelow: any;
    dec: any;
    anchor: any;
    type = "DynamicDecoration";
    pitch = undefined;

    constructor(anchor, dec, position) {
        this.anchor = anchor;
        this.dec = dec;
        if (position === 'below')
            this.volumeHeightBelow = 6;
        else
            this.volumeHeightAbove = 6;
    }
}
export default DynamicDecoration;
