class GetTextSize {
    constructor(getFontAndAttr, svg) {
        this.getFontAndAttr = getFontAndAttr;
        this.svg = svg;
    }
    updateFonts(fontOverrides) {
        this.getFontAndAttr.updateFonts(fontOverrides);
    }
    attr(type, klass) {
        return this.getFontAndAttr.calc(type, klass);
    }
    getFamily(type) {
        if (type[0] === '"' && type[type.length - 1] === '"') {
            return type.substring(1, type.length - 1);
        }
        return type;
    }
    calc(text, type, klass, el) {
        let hash;
        if (typeof type === 'string')
            hash = this.attr(type, klass);
        else {
            hash = {
                font: {
                    face: type.face,
                    size: type.size,
                    decoration: type.decoration,
                    style: type.style,
                    weight: type.weight,
                    box: type.box,
                    padding: type.padding
                },
                attr: {
                    "font-size": type.size,
                    "font-style": type.style,
                    "font-family": this.getFamily(type.face),
                    "font-weight": type.weight,
                    "text-decoration": type.decoration,
                    "class": this.getFontAndAttr.classes.generate(klass)
                }
            };
        }
        const size = this.svg.getTextSize(text, hash.attr, el);
        if (hash.font.box) {
            const padding = hash.font.padding || 0;
            return { height: size.height + padding * 4, width: size.width + padding * 4 };
        }
        return size;
    }
    baselineToCenter(text, type, klass, index, total) {
        const height = this.calc(text, type, klass).height;
        const fontHeight = this.attr(type, klass).font.size;
        return height * 0.5 + (total - index - 2) * fontHeight;
    }
}
export default GetTextSize;
