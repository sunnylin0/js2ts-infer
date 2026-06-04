class FreeText {
    constructor(info, vskip, getFontAndAttr, paddingLeft, width, getTextSize) {
        this.rows = [];
        const text = info.text;
        this.rows = [];
        let size;
        if (vskip)
            this.rows.push({ move: vskip });
        const hash = getFontAndAttr.calc('textfont', 'defined-text');
        if (text === "") {
            this.rows.push({ move: hash.attr['font-size'] * 2 });
        }
        else if (typeof text === 'string') {
            this.rows.push({ move: hash.attr['font-size'] / 2 });
            this.rows.push({ left: paddingLeft, text: text, font: 'textfont', klass: 'defined-text', anchor: "start", startChar: info.startChar, endChar: info.endChar, absElemType: "freeText", name: "free-text" });
            const replaceStandaloneNewlinesForTextBlocks = (input) => {
                return input.replace(/^[ \t]*\n/gm, 'X\n');
            };
            const textForSize = replaceStandaloneNewlinesForTextBlocks(text);
            size = getTextSize.calc(textForSize, 'textfont', 'defined-text');
            this.rows.push({ move: size.height });
        }
        else if (text) {
            let maxHeight = 0;
            let leftSide = paddingLeft;
            let currentFont = 'textfont';
            for (let i = 0; i < text.length; i++) {
                if (text[i].font) {
                    currentFont = text[i].font;
                }
                else
                    currentFont = 'textfont';
                this.rows.push({ left: leftSide, text: text[i].text, font: currentFont, klass: 'defined-text', anchor: 'start', startChar: info.startChar, endChar: info.endChar, absElemType: "freeText", name: "free-text" });
                size = getTextSize.calc(text[i].text, getFontAndAttr.calc(currentFont, 'defined-text').font, 'defined-text');
                leftSide += size.width + size.height / 2;
                maxHeight = Math.max(maxHeight, size.height);
            }
            this.rows.push({ move: maxHeight });
        }
        else {
            if (info.length === 1) {
                const x = width / 2;
                this.rows.push({ left: x, text: info[0].text, font: 'textfont', klass: 'defined-text', anchor: 'middle', startChar: info.startChar, endChar: info.endChar, absElemType: "freeText", name: "free-text" });
                size = getTextSize.calc(info[0].text, 'textfont', 'defined-text');
                this.rows.push({ move: size.height });
            }
        }
    }
}
export default FreeText;
