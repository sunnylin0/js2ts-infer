function getLeftEdgeOfStaff(renderer: Renderer, getTextSize: GetTextSize, voices: Array<VoiceElement>, brace: any, bracket: Array<BraceElem>): number {
    let x: number = renderer.padding.left;
    // find out how much space will be taken up by voice headers
    let voiceheaderw: number = 0;
    let size;
    for (let i: number = 0; i < voices.length; i++) {
        if (voices[i].header) {
            size = getTextSize.calc(voices[i].header, 'voicefont', '');
            voiceheaderw = Math.max(voiceheaderw, size.width);
        }
    }
    voiceheaderw = addBraceSize(voiceheaderw, brace, getTextSize);
    voiceheaderw = addBraceSize(voiceheaderw, bracket, getTextSize);
    if (voiceheaderw) {
        // Give enough spacing to the right - we use the width of an A for the amount of spacing.
        const sizeW = getTextSize.calc("A", 'voicefont', '');
        voiceheaderw += sizeW.width;
    }
    x += voiceheaderw;
    let ofs: number = 0;
    ofs = setBraceLocation(brace, x, ofs);
    ofs = setBraceLocation(bracket, x, ofs);
    return x + ofs;
}
function addBraceSize(voiceheaderw: number, brace: Array<BraceElem>, getTextSize: GetTextSize): number {
    if (brace) {
        for (let i: number = 0; i < brace.length; i++) {
            if (brace[i].header) {
                const size = getTextSize.calc(brace[i].header, 'voicefont', '');
                voiceheaderw = Math.max(voiceheaderw, size.width);
            }
        }
    }
    return voiceheaderw;
}
function setBraceLocation(brace: Array<BraceElem>, x: number, ofs: number): number {
    if (brace) {
        for (let i: number = 0; i < brace.length; i++) {
            setLocation(x, brace[i]);
            ofs = Math.max(ofs, brace[i].getWidth());
        }
    }
    return ofs;
}
function setLocation(x: number, element: BraceElem): void {
    element.x = x;
}
export default getLeftEdgeOfStaff;
