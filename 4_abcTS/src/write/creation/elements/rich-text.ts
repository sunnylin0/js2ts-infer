import addTextIf from "../add-text-if";
function richText(rows: Array<any> | Array<{ [key: string]: any }>, str: string|any[], defFont: string, klass: string, name: string, paddingLeft: number, attr: any, getTextSize: GetTextSize): void {
    const space = getTextSize.calc("i", defFont, klass);
    if (str === '') {
        rows.push({ move: space.height });
    }
    else {
        if (typeof str === 'string') {
            addTextIf(rows, { marginLeft: paddingLeft, text: str, font: defFont, klass: klass, marginTop: attr.marginTop, anchor: attr.anchor, absElemType: attr.absElemType, info: attr.info, name: name }, getTextSize);
            return;
        }
        if (attr.marginTop)
            rows.push({ move: attr.marginTop });
        let largestY: number = 0;
        const row = {
            left: paddingLeft,
            anchor: attr.anchor,
            phrases: []
        };
        if (klass)
            row.klass = klass;
        rows.push(row);
        for (let k: number = 0; k < str.length; k++) {
            const thisWord = str[k];
            const font = (thisWord.font) ? thisWord.font : getTextSize.attr(defFont, klass).font;
            const phrase = {
                content: thisWord.text,
            };
            if (font)
                phrase.attrs = {
                    "font-family": getTextSize.getFamily(font.face),
                    "font-size": font.size,
                    "font-weight": font.weight,
                    "font-style": font.style,
                    "font-decoration": font.decoration,
                };
            row.phrases.push(phrase);
            const size = getTextSize.calc(thisWord.text, font, klass);
            largestY = Math.max(largestY, size.height);
        }
        rows.push({ move: largestY });
    }
}
export default richText;
