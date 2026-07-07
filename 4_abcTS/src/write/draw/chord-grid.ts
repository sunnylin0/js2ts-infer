import printSymbol from "./print-symbol";
import printStem from "./print-stem";
function drawChordGrid(renderer: Renderer, parts, leftMargin: number, pageWidth: number, fonts: Formatting): void {
    const partingFont: Font = fonts.partsfont;
    const annotationFont: Font = fonts.annotationfont;
    const endingFont: Font = fonts.repeatfont;
    const textFont: Font = fonts.textfont;
    const subtitleFont: Font = fonts.subtitlefont;
    const ROW_HEIGHT: number = 50;
    const ENDING_HEIGHT: number = 10;
    const ANNOTATION_HEIGHT: number = 14;
    const PART_MARGIN_TOP: number = 10;
    const PART_MARGIN_BOTTOM: number = 20;
    const TEXT_MARGIN: number = 16;
    renderer.paper.openGroup({ klass: 'abcjs-chord-grid' });
    parts.forEach(part => {
        switch (part.type) {
            case "text":
                {
                    text(renderer, part.text, leftMargin, renderer.y, 16, textFont, null, null, false);
                    renderer.moveY(TEXT_MARGIN);
                }
                break;
            case "subtitle":
                {
                    text(renderer, part.subtitle, leftMargin, renderer.y + PART_MARGIN_TOP, 20, subtitleFont, null, "abcjs-subtitle", false);
                    renderer.moveY(PART_MARGIN_BOTTOM);
                }
                break;
            case "part":
                if (part.lines.length > 0) {
                    text(renderer, part.name, leftMargin, renderer.y + PART_MARGIN_TOP, 20, subtitleFont, part.name, "abcjs-part", false);
                    renderer.moveY(PART_MARGIN_BOTTOM);
                    const numCols = part.lines[0].length;
                    const colWidth: number = pageWidth / numCols;
                    part.lines.forEach((line, lineNum) => {
                        let hasEnding: boolean = false;
                        let hasAnnotation: boolean = false;
                        line.forEach(measure => {
                            if (measure.ending)
                                hasEnding = true;
                            if (measure.annotations && measure.annotations.length > 0)
                                hasAnnotation = true;
                        });
                        const extraTop: number = hasAnnotation ? ANNOTATION_HEIGHT : hasEnding ? ENDING_HEIGHT : 0;
                        line.forEach((measure, barNum) => {
                            const RECT_WIDTH: number = 1;
                            if (!measure.noBorder) {
                                renderer.paper.rect({ x: leftMargin + barNum * colWidth, y: renderer.y, width: colWidth, height: extraTop + ROW_HEIGHT });
                                renderer.paper.rect({ x: leftMargin + barNum * colWidth + RECT_WIDTH, y: renderer.y + RECT_WIDTH, width: colWidth - RECT_WIDTH * 2, height: extraTop + ROW_HEIGHT - RECT_WIDTH * 2 });
                                let repeatLeft: number = 0;
                                let repeatRight: number = 0;
                                const top: number = renderer.y;
                                const left: number = leftMargin + colWidth * barNum;
                                if (measure.hasStartRepeat) {
                                    drawRepeat(renderer, left, top, top + ROW_HEIGHT + extraTop, true, extraTop);
                                    repeatLeft = 12;
                                }
                                if (measure.hasEndRepeat) {
                                    drawRepeat(renderer, left + colWidth, top, top + ROW_HEIGHT + extraTop, false, extraTop);
                                    repeatRight = 12;
                                }
                                let endingWidth: number = 0;
                                if (measure.ending) {
                                    const endingEl = text(renderer, measure.ending, leftMargin + barNum * colWidth + 4, top + 10, 12, endingFont, null, null, false);
                                    endingWidth = endingEl.getBBox().width + 4;
                                }
                                drawMeasure(renderer, top, leftMargin + repeatLeft, colWidth, lineNum, barNum, measure.chord, fonts.gchordfont, repeatLeft + repeatRight, ROW_HEIGHT, extraTop);
                                if (measure.annotations && measure.annotations.length > 0) {
                                    drawAnnotations(renderer, top, leftMargin + barNum * colWidth + endingWidth, measure.annotations, annotationFont);
                                }
                                if (extraTop) {
                                    renderer.paper.rectBeneath({ x: leftMargin + barNum * colWidth, y: renderer.y, width: colWidth, height: extraTop, fill: '#e8e8e8', stroke: 'none' });
                                }
                            }
                        });
                        renderer.moveY(extraTop + ROW_HEIGHT);
                    });
                    renderer.moveY(PART_MARGIN_BOTTOM);
                }
                break;
        }
    });
    renderer.paper.closeGroup();
}
function drawPercent(renderer: Renderer, x: number, y: number, offset: number): void {
    const lineX1: number = x - 10;
    const lineX2 = x + 10;
    const lineY1 = y + 10;
    const lineY2: number = y - 10;
    const leftDotX: number = x - 10;
    const leftDotY: number = -renderer.yToPitch(offset) + 2;
    const rightDotX = x + 6.5;
    const rightDotY: number = -renderer.yToPitch(offset) - 2.3;
    renderer.paper.lineToBack({ x1: lineX1, x2: lineX2, y1: lineY1, y2: lineY2, 'stroke-width': '3px', 'stroke-linecap': "round" });
    printSymbol(renderer, leftDotX, leftDotY, "dots.dot", {
        scalex: 1,
        scaley: 1,
        klass: "",
        name: "dot"
    });
    printSymbol(renderer, rightDotX, rightDotY, "dots.dot", {
        scalex: 1,
        scaley: 1,
        klass: "",
        name: "dot"
    });
}
function drawRepeat(renderer: Renderer, x: number, y1: number, y2: number, isStart: boolean, offset: number): void {
    const lineX: number = isStart ? x + 2 : x - 4;
    const circleX: number = isStart ? x + 9 : x - 11;
    renderer.paper.openGroup({ klass: 'abcjs-repeat' });
    printStem(renderer, lineX, 3 + renderer.lineThickness, y1, y2, undefined, "bar");
    printSymbol(renderer, circleX, -renderer.yToPitch(offset) - 4, "dots.dot", {
        scalex: 1,
        scaley: 1,
        klass: "",
        name: "dot"
    });
    printSymbol(renderer, circleX, -renderer.yToPitch(offset) - 8, "dots.dot", {
        scalex: 1,
        scaley: 1,
        klass: "",
        name: "dot"
    });
    renderer.paper.closeGroup();
}
const symbolsMapping = {
    'segno': "scripts.segno",
    'coda': "scripts.coda",
    "fermata": "scripts.ufermata",
};
function drawAnnotations(renderer: Renderer, offset: number, left: number, annotations, annotationFont: Font): void {
    left += 3;
    let el;
    for (let a: number = 0; a < annotations.length; a++) {
        const symbolKey = annotations[a];
        if (symbolsMapping[symbolKey]) {
            left += 12;
            el = printSymbol(renderer, left, -3, symbolsMapping[symbolKey], {
                scalex: 1,
                scaley: 1,
                name: symbolsMapping[symbolKey]
            });
            if (el) {
                const box = el.getBBox();
                left += box.width;
            }
        }
        else {
            text(renderer, annotations[a], left, offset + 12, 12, annotationFont, null, null, false);
        }
    }
}
function drawMeasure(renderer: Renderer, offset: number, leftMargin: number, colWidth: number, lineNum, barNum, chords, chordFont: Font, margin: number, height: number, extraTop: number): void {
    const left: number = leftMargin + colWidth * barNum;
    if (!chords[1] && !chords[2] && !chords[3])
        drawSingleChord(renderer, left, offset + extraTop, colWidth - margin, height, chords[0], chordFont, extraTop);
    else if (!chords[1] && !chords[3])
        drawTwoChords(renderer, left, offset, colWidth - margin, height, chords[0], chords[2], chordFont, extraTop);
    else
        drawFourChords(renderer, left, offset, colWidth - margin, height, chords, chordFont, extraTop);
}
function renderChord(renderer: Renderer, x: number, y: number, size: number, chord, font, maxWidth: number): void {
    const el = text(renderer, chord, x, y, size, font, null, "abcjs-chord", true);
    let bb = el.getBBox();
    let fontSize: number = size;
    while (bb.width > maxWidth && fontSize >= 14) {
        fontSize -= 2;
        el.setAttribute('font-size', fontSize.toString());
        bb = el.getBBox();
    }
}
const MAX_ONE_CHORD: number = 34;
const MAX_TWO_CHORDS: number = 26;
const MAX_FOUR_CHORDS: number = 20;
const TOP_MARGIN_VAL: number = -3;
function drawSingleChord(renderer: Renderer, left: number, top: number, width: number, height: number, chord, font: Font, extraTop: number): void {
    if (chord === '%')
        drawPercent(renderer, left + width / 2, top + height / 2, extraTop + height / 2);
    else
        renderChord(renderer, left + width / 2, top + height / 2 + TOP_MARGIN_VAL, MAX_ONE_CHORD, chord, font, width);
}
function drawTwoChords(renderer: Renderer, left: number, top: number, width: number, height: number, chord1, chord2, font: Font, extraTop: number): void {
    renderer.paper.lineToBack({ x1: left, x2: left + width, y1: top + height + extraTop, y2: top + 2 });
    renderChord(renderer, left + width / 4, top + height / 4 + 5 + extraTop + TOP_MARGIN_VAL, MAX_TWO_CHORDS, chord1, font, width / 2);
    renderChord(renderer, left + 3 * width / 4, top + 3 * height / 4 + extraTop + TOP_MARGIN_VAL, MAX_TWO_CHORDS, chord2, font, width / 2);
}
function drawFourChords(renderer: Renderer, left: number, top: number, width: number, height: number, chords, font: Font, extraTop: number): void {
    const LOCAL_MARGIN: number = 3;
    renderer.paper.lineToBack({ x1: left + LOCAL_MARGIN, x2: left + width - LOCAL_MARGIN, y1: top + height / 2 + extraTop, y2: top + height / 2 + extraTop });
    renderer.paper.lineToBack({ x1: left + width / 2, x2: left + width / 2, y1: top + LOCAL_MARGIN + extraTop, y2: top + height - LOCAL_MARGIN + extraTop });
    if (chords[0])
        renderChord(renderer, left + width / 4, top + height / 4 + 2 + extraTop + TOP_MARGIN_VAL, MAX_FOUR_CHORDS, shortenChord(chords[0]), font, width / 2);
    if (chords[1])
        renderChord(renderer, left + 3 * width / 4, top + height / 4 + 2 + extraTop + TOP_MARGIN_VAL, MAX_FOUR_CHORDS, shortenChord(chords[1]), font, width / 2);
    if (chords[2])
        renderChord(renderer, left + width / 4, top + 3 * height / 4 + extraTop + TOP_MARGIN_VAL, MAX_FOUR_CHORDS, shortenChord(chords[2]), font, width / 2);
    if (chords[3])
        renderChord(renderer, left + 3 * width / 4, top + 3 * height / 4 + extraTop + TOP_MARGIN_VAL, MAX_FOUR_CHORDS, shortenChord(chords[3]), font, width / 2);
}
function shortenChord(chord): string {
    if (chord === "No Chord")
        return "N.C.";
    return chord;
}
function text(renderer: Renderer, str, x: number, y: number, size: number, font: Font, dataName, klass: string, alignCenter: boolean) {
    const attr = {
        x: x,
        y: y,
        stroke: "none",
        'font-size': size,
        'font-style': font.style,
        'font-family': font.face,
        'font-weight': font.weight,
        'text-decoration': font.decoration,
    };
    if (dataName)
        attr['data-name'] = dataName;
    if (klass)
        attr['class'] = klass;
    attr["text-anchor"] = alignCenter ? "middle" : "start";
    return renderer.paper.text(str, attr, null, { "alignment-baseline": "middle" });
}
export default drawChordGrid;
