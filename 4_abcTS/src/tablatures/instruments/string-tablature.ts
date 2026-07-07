export default class StringTablature {
    bar: any;
    verticalSize: any;
    lineSpace: any;
    numLines: any;
    /** Added default to match usage in setRelative */
    height = 0;

    constructor(numLines, lineSpace) {
        this.numLines = numLines;
        this.lineSpace = lineSpace;
        this.verticalSize = this.numLines * this.lineSpace;
        const pitch: number = 3;
        this.bar = {
            pitch: pitch,
            pitch2: lineSpace * numLines,
            height: 5,
        };
    }
    bypass(line): boolean {
        const voices = line.staffGroup.voices;
        if (voices.length > 0) {
            if (voices[0].isPercussion)
                return true;
        }
        return false;
    }
    setRelative(child, relative, first): boolean {
        switch (child.type) {
            case 'bar':
                relative.pitch = this.bar.pitch;
                relative.pitch2 = this.bar.pitch2;
                relative.height = this.height;
                break;
            case 'symbol':
                const top: number = this.bar.pitch2 / 2;
                if (child.name === 'dots.dot') {
                    if (first) {
                        relative.pitch = top;
                        return false;
                    }
                    else {
                        relative.pitch = top + this.lineSpace;
                        return true;
                    }
                }
                break;
        }
        return first;
    }
}
