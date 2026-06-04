import addTextIf from "../add-text-if";
import richText from "./rich-text";
class BottomText {
    constructor(metaText, width, isPrint, paddingLeft, spacing, shouldAddClasses, getTextSize) {
        this.rows = [];
        this.rows = [];
        if (metaText.unalignedWords && metaText.unalignedWords.length > 0)
            this.unalignedWords(metaText.unalignedWords, paddingLeft, spacing, shouldAddClasses, getTextSize);
        this.extraText(metaText, paddingLeft, spacing, shouldAddClasses, getTextSize);
        if (metaText.footer && isPrint)
            this.footer(metaText.footer, width, paddingLeft, getTextSize);
    }
    unalignedWords(unalignedWords, marginLeft, spacing, shouldAddClasses, getTextSize) {
        const klass = shouldAddClasses ? 'abcjs-unaligned-words' : '';
        const defFont = 'wordsfont';
        const space = getTextSize.calc("i", defFont, klass);
        this.rows.push({ move: spacing.words });
        addMultiLine(this.rows, '', unalignedWords, marginLeft, defFont, "unalignedWords", "unalignedWords", klass, "unalignedWords", spacing, shouldAddClasses, getTextSize);
        this.rows.push({ move: space.height });
    }
    extraText(metaText, marginLeft, spacing, shouldAddClasses, getTextSize) {
        addSingleLine(this.rows, "Book: ", metaText.book, marginLeft, 'abcjs-book', shouldAddClasses, getTextSize);
        addSingleLine(this.rows, "Source: ", metaText.source, marginLeft, 'abcjs-source', shouldAddClasses, getTextSize);
        addSingleLine(this.rows, "Discography: ", metaText.discography, marginLeft, 'abcjs-discography', shouldAddClasses, getTextSize);
        addMultiLine(this.rows, 'Notes:', metaText.notes, marginLeft, 'historyfont', "extraText", "notes", 'abcjs-notes', "description", spacing, shouldAddClasses, getTextSize);
        addSingleLine(this.rows, "Transcription: ", metaText.transcription, marginLeft, 'abcjs-transcription', shouldAddClasses, getTextSize);
        addMultiLine(this.rows, "History:", metaText.history, marginLeft, 'historyfont', "extraText", "history", 'abcjs-history', "description", spacing, shouldAddClasses, getTextSize);
        addSingleLine(this.rows, "Copyright: ", metaText['abc-copyright'], marginLeft, 'abcjs-copyright', shouldAddClasses, getTextSize);
        addSingleLine(this.rows, "Creator: ", metaText['abc-creator'], marginLeft, 'abcjs-creator', shouldAddClasses, getTextSize);
        addSingleLine(this.rows, "Edited By: ", metaText['abc-edited-by'], marginLeft, 'abcjs-edited-by', shouldAddClasses, getTextSize);
    }
    footer(footer, width, paddingLeft, getTextSize) {
        const klass = 'header meta-bottom';
        const font = "footerfont";
        this.rows.push({ startGroup: "footer", klass: klass });
        addTextIf(this.rows, { marginLeft: paddingLeft, text: footer.left, font: font, klass: klass, name: "footer" }, getTextSize);
        addTextIf(this.rows, { marginLeft: paddingLeft + width / 2, text: footer.center, font: font, klass: klass, anchor: 'middle', name: "footer" }, getTextSize);
        addTextIf(this.rows, { marginLeft: paddingLeft + width, text: footer.right, font: font, klass: klass, anchor: 'end', name: "footer" }, getTextSize);
    }
}
function addSingleLine(rows, preface, text, marginLeft, klass, shouldAddClasses, getTextSize) {
    if (text) {
        if (preface) {
            if (typeof text === 'string')
                text = preface + text;
            else
                text = [{ text: preface }].concat(text);
        }
        const fullKlass = shouldAddClasses ? 'abcjs-extra-text ' + klass : '';
        richText(rows, text, 'historyfont', fullKlass, "description", marginLeft, { absElemType: "extraText", anchor: 'start' }, getTextSize);
    }
}
function addMultiLine(rows, preface, content, marginLeft, defFont, absElemType, groupName, klass, name, spacing, shouldAddClasses, getTextSize) {
    if (content) {
        const fullKlass = shouldAddClasses ? 'abcjs-extra-text ' + klass : '';
        const size = getTextSize.calc("A", defFont, fullKlass);
        if (typeof content === 'string') {
            if (preface)
                content = preface + "\n" + content;
            addTextIf(rows, { marginLeft: marginLeft, text: content, font: defFont, absElemType: "extraText", name: name, 'dominant-baseline': 'middle', klass: fullKlass }, getTextSize);
        }
        else {
            rows.push({ startGroup: groupName, klass: fullKlass, name: name });
            rows.push({ move: spacing.info });
            if (preface) {
                addTextIf(rows, { marginLeft: marginLeft, text: preface, font: defFont, absElemType: "extraText", name: name, 'dominant-baseline': 'middle' }, getTextSize);
                rows.push({ move: size.height * 3 / 4 });
            }
            for (let j = 0; j < content.length; j++) {
                richText(rows, content[j], defFont, '', name, marginLeft, { anchor: 'start' }, getTextSize);
                if (j < content.length - 1 && typeof content[j] === 'string' && typeof content[j + 1] !== 'string')
                    rows.push({ move: size.height * 3 / 4 });
            }
            rows.push({ endGroup: groupName, absElemType: absElemType, startChar: -1, endChar: -1, name: name });
            rows.push({ move: size.height });
        }
    }
}
export default BottomText;
