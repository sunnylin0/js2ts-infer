class GetFontAndAttr {
    constructor(formatting, classes) {
        this.formatting = formatting;
        this.classes = classes;
    }
    updateFonts(fontOverrides) {
        if (fontOverrides.gchordfont)
            this.formatting.gchordfont = fontOverrides.gchordfont;
        if (fontOverrides.tripletfont)
            this.formatting.tripletfont = fontOverrides.tripletfont;
        if (fontOverrides.annotationfont)
            this.formatting.annotationfont = fontOverrides.annotationfont;
        if (fontOverrides.vocalfont)
            this.formatting.vocalfont = fontOverrides.vocalfont;
    }
    getFamily(type) {
        if (type[0] === '"' && type[type.length - 1] === '"') {
            return type.substring(1, type.length - 1);
        }
        return type;
    }
    calc(type, klass) {
        let font;
        if (typeof type === 'string') {
            const f = this.formatting[type];
            if (f)
                font = { face: f.face, size: Math.round(f.size * 4 / 3), decoration: f.decoration, style: f.style, weight: f.weight, box: f.box };
            else
                font = { face: "Arial", size: Math.round(12 * 4 / 3), decoration: "underline", style: "normal", weight: "normal" };
        }
        else {
            font = {
                face: type.face || "Arial",
                size: Math.round((type.size || 12) * 4 / 3),
                decoration: type.decoration,
                style: type.style,
                weight: type.weight,
                box: type.box
            };
        }
        const paddingPercent = this.formatting.fontboxpadding ? this.formatting.fontboxpadding : 0.1;
        font.padding = font.size * paddingPercent;
        const attr = {
            "font-size": font.size,
            'font-style': font.style,
            "font-family": this.getFamily(font.face),
            'font-weight': font.weight,
            'text-decoration': font.decoration,
            'class': this.classes.generate(klass)
        };
        return { font: font, attr: attr };
    }
}
export default GetFontAndAttr;
