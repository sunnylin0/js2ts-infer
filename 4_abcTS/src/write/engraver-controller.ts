//    abc_engraver_controller.ts: Controls the engraving process of an ABCJS abstract syntax tree as produced by ABCJS/parse
import spacing from "./helpers/spacing";
import AbstractEngraver from "./creation/abstract-engraver";
import Renderer from "./renderer";
import FreeText from "./creation/elements/free-text";
import Separator from "./creation/elements/separator";
import Subtitle from "./creation/elements/subtitle";
import TopText from "./creation/elements/top-text";
import BottomText from "./creation/elements/bottom-text";
import setupSelection from "./interactive/selection";
import layout from "./layout/layout";
import Classes from "./helpers/classes";
import GetFontAndAttr from "./helpers/get-font-and-attr";
import GetTextSize from "./helpers/get-text-size";
import draw from "./draw/draw";
import tablatures from "../tablatures/abc_tablatures";
import findSelectableElement from "./interactive/find-selectable-element";
class EngraverController {
    chordGrid: any;
    lineThickness: any;
    germanAlphabet: any;
    accentAbove: any;
    jazzchords: any;
    renderer: Renderer;
    staffwidthPrint: number;
    staffwidthScreen: number;
    classes: Classes;
    scale: number;
    expandToWidest: boolean;
    timeBasedLayout: any;
    initialClef: any;
    responsive: any;
    selectTypes: any;
    dragging: boolean;
    dragColor: string;
    selectionColor: string;
    oneSvgPerLine: boolean;
    findSelectableElement: Function = findSelectableElement;
    listeners: any[] = [];
    engraver: AbstractEngraver = null;
    selected: any[] = [];
    staffgroups: StaffGroupElement[] = [];
    dragTarget: any = null;
    dragIndex: number = -1;
    dragMouseStart: DragMouseStart = { x: -1, y: -1 };
    dragYStep: number = 0;
    getFontAndAttr: GetFontAndAttr = null;
    getTextSize: GetTextSize = null;
    width: number = 0;
    svgs: SVGSVGElement[] = [];
    selectables: Selectables[] = [];
    space: number = 3 * spacing.SPACE;

    constructor(paper: HTMLDivElement, params: any) {
        params = params || {};
        this.oneSvgPerLine = !!params.oneSvgPerLine;
        this.selectionColor = params.selectionColor || "";
        this.dragColor = params.dragColor ? params.dragColor : (params.selectionColor || "");
        this.dragging = !!params.dragging;
        this.selectTypes = params.selectTypes;
        this.responsive = params.responsive;
        this.initialClef = params.initialClef;
        this.timeBasedLayout = params.timeBasedLayout;
        this.expandToWidest = !!params.expandToWidest;
        this.scale = params.scale ? (typeof params.scale === 'string' ? parseFloat(params.scale) : params.scale) : 0;
        this.classes = new Classes({ shouldAddClasses: !!params.add_classes });
        if (!(this.scale > 0.1))
            this.scale = 1;
        if (params.staffwidth) {
            // Note: Normally all measurements to the engraver are in POINTS. However, if a person is formatting for the
            // screen and directly inputting the width, then it is more logical to have the measurement in pixels.
            this.staffwidthScreen = params.staffwidth;
            this.staffwidthPrint = params.staffwidth;
        }
        else {
            this.staffwidthScreen = 740; // TODO-PER: Not sure where this number comes from, but this is how it's always been.
            this.staffwidthPrint = 680; // The number of pixels in 8.5", after 1cm of margin has been removed.
        }
        if (params.clickListener)
            this.addSelectListener(params.clickListener);
        this.renderer = new Renderer(paper);
        this.renderer.setPaddingOverride(params);
        if (params.showDebug)
            this.renderer.showDebug = params.showDebug;
        if (params.jazzchords)
            this.jazzchords = params.jazzchords;
        if (params.accentAbove)
            this.accentAbove = params.accentAbove;
        if (params.germanAlphabet)
            this.germanAlphabet = params.germanAlphabet;
        if (params.lineThickness)
            this.lineThickness = params.lineThickness;
        if (params.chordGrid)
            this.chordGrid = params.chordGrid;
        this.renderer.controller = this; // TODO-GD needed for highlighting
        this.renderer.foregroundColor = params.foregroundColor ? params.foregroundColor : "currentColor";
        if (params.ariaLabel !== undefined)
            this.renderer.ariaLabel = params.ariaLabel;
        this.renderer.minPadding = params.minPadding ? params.minPadding : 0;
        this.reset();
    }
    reset(): void {
        this.selected = [];
        this.staffgroups = [];
        if (this.engraver)
            this.engraver.reset();
        this.engraver = null;
        this.renderer.reset();
        this.dragTarget = null;
        this.dragIndex = -1;
        this.dragMouseStart = { x: -1, y: -1 };
        this.dragYStep = 0;
        if (this.lineThickness)
            this.renderer.setLineThickness(this.lineThickness);
    }
    /**
     * run the engraving process
     */
    engraveABC(abctunes: Tune, tuneNumber: number, lineOffset: number): void {
        let tunes;
        if (!Array.isArray(abctunes)) {
            tunes = [abctunes];
        }
        else {
            tunes = abctunes;
        }
        this.reset();
        for (var i: number = 0; i < tunes.length; i++) {
            if (tuneNumber === undefined)
                tuneNumber = i;
            this.getFontAndAttr = new GetFontAndAttr(tunes[i].formatting, this.classes);
            this.getTextSize = new GetTextSize(this.getFontAndAttr, this.renderer.paper);
            this.engraveTune(tunes[i], tuneNumber, lineOffset);
        }
    }
    /**
     * Some of the items on the page are not scaled, so adjust them in the opposite direction of scaling to cancel out the scaling.
     */
    adjustNonScaledItems(scale: number): void {
        this.width /= scale;
        this.renderer.adjustNonScaledItems(scale);
    }
    getMeasureWidths(abcTune: Tune): {
        		left: number;
        		measureWidths: never[];
        		total: number;
        	}[] {
        this.reset();
        this.getFontAndAttr = new GetFontAndAttr(abcTune.formatting, this.classes);
        this.getTextSize = new GetTextSize(this.getFontAndAttr, this.renderer.paper);
        var origJazzChords = this.jazzchords;
        this.setupTune(abcTune, 0);
        this.constructTuneElements(abcTune);
        // layout() sets the x-coordinate of the abcTune element here:
        // abcTune.lines[0].staffGroup.voices[0].children[0].x
        layout(this.renderer, abcTune, 0, this.space, this.timeBasedLayout);
        var ret = [];
        var section;
        var needNewSection: boolean = true;
        for (var i: number = 0; i < abcTune.lines.length; i++) {
            var abcLine: Lines = abcTune.lines[i];
            if (abcLine.staff) {
                if (needNewSection) {
                    section = {
                        left: 0,
                        measureWidths: [],
                        //height: this.renderer.padding.top + this.renderer.spacing.music + this.renderer.padding.bottom + 24, // the 24 is the empirical value added to the bottom of all tunes.
                        total: 0,
                    };
                    ret.push(section);
                    needNewSection = false;
                }
                // At this point, the voices are laid out so that the bar lines are even with each other. So we just need to get the placement of the first voice.
                if (abcLine.staffGroup.voices.length > 0) {
                    var voice: VoiceElement = abcLine.staffGroup.voices[0];
                    var foundNotStaffExtra: boolean = false;
                    var lastXPosition: number = 0;
                    for (var k: number = 0; k < voice.children.length; k++) {
                        var child: AbsoluteElement = voice.children[k];
                        if (!foundNotStaffExtra && !child.isClef && !child.isKeySig) {
                            foundNotStaffExtra = true;
                            section.left = child.x;
                            lastXPosition = child.x;
                        }
                        if (child.type === "bar") {
                            section.measureWidths.push(child.x - lastXPosition);
                            section.total += child.x - lastXPosition;
                            lastXPosition = child.x;
                        }
                    }
                }
                //section.height += calcHeight(abcLine.staffGroup) * spacing.STEP;
            }
            else
                needNewSection = true;
        }
        this.jazzchords = origJazzChords;
        return ret;
    }
    setupTune(abcTune: Tune, tuneNumber: number): number {
        this.classes.reset();
        if (abcTune.formatting.jazzchords !== undefined)
            this.jazzchords = abcTune.formatting.jazzchords;
        if (abcTune.formatting.accentAbove !== undefined)
            this.accentAbove = abcTune.formatting.accentAbove;
        this.renderer.newTune(abcTune);
        this.engraver = new AbstractEngraver(this.getTextSize, tuneNumber, {
            bagpipes: abcTune.formatting.bagpipes,
            flatbeams: abcTune.formatting.flatbeams,
            graceSlurs: abcTune.formatting.graceSlurs !== false, // undefined is the default, which is true
            percmap: abcTune.formatting.percmap,
            initialClef: this.initialClef,
            jazzchords: this.jazzchords,
            timeBasedLayout: this.timeBasedLayout,
            accentAbove: this.accentAbove,
            germanAlphabet: this.germanAlphabet,
        });
        this.engraver.setStemHeight(this.renderer.spacing.stemHeight);
        this.engraver.measureLength = abcTune.getMeterFraction().num / (abcTune.getMeterFraction().den || 1);
        if (abcTune.formatting.staffwidth) {
            this.width = abcTune.formatting.staffwidth * 1.33; // The width is expressed in pt; convert to px.
        }
        else {
            this.width = this.renderer.isPrint ? this.staffwidthPrint : this.staffwidthScreen;
        }
        var scale: number = abcTune.formatting.scale ? abcTune.formatting.scale : this.scale;
        if (this.responsive === "resize")
            // The resizing will mess with the scaling, so just don't do it explicitly.
            scale = undefined;
        if (scale === undefined)
            scale = this.renderer.isPrint ? 0.75 : 1;
        this.adjustNonScaledItems(scale);
        return scale;
    }
    constructTuneElements(abcTune: Tune): void {
        abcTune.topText = new TopText(abcTune.metaText, abcTune.metaTextInfo, abcTune.formatting, abcTune.lines, this.width, this.renderer.isPrint, this.renderer.padding.left, this.renderer.spacing, this.classes.shouldAddClasses, this.getTextSize);
        // Generate the raw staff line data
        var i;
        var abcLine;
        var hasPrintedTempo: boolean = false;
        var hasSeenNonSubtitle: boolean = false;
        for (i = 0; i < abcTune.lines.length; i++) {
            abcLine = abcTune.lines[i];
            if (abcLine.staff) {
                hasSeenNonSubtitle = true;
                abcLine.staffGroup = this.engraver.createABCLine(abcLine.staff, !hasPrintedTempo ? abcTune.metaText.tempo : null, i);
                hasPrintedTempo = true;
            }
            else if (abcLine.subtitle) {
                // If the subtitle is at the top, then it was already accounted for. So skip all subtitles until the first non-subtitle line.
                if (hasSeenNonSubtitle) {
                    var center: number = this.width / 2 + this.renderer.padding.left;
                    abcLine.nonMusic = new Subtitle(this.renderer.spacing.subtitle, abcTune.formatting, abcLine.subtitle, center, this.renderer.padding.left, this.getTextSize);
                }
            }
            else if (abcLine.text !== undefined) {
                hasSeenNonSubtitle = true;
                abcLine.nonMusic = new FreeText(abcLine.text, abcLine.vskip, this.getFontAndAttr, this.renderer.padding.left, this.width, this.getTextSize);
            }
            else if (abcLine.separator !== undefined && abcLine.separator.lineLength) {
                hasSeenNonSubtitle = true;
                abcLine.nonMusic = new Separator(abcLine.separator.spaceAbove, abcLine.separator.lineLength, abcLine.separator.spaceBelow);
            }
        }
        abcTune.bottomText = new BottomText(abcTune.metaText, this.width, this.renderer.isPrint, this.renderer.padding.left, this.renderer.spacing, this.classes.shouldAddClasses, this.getTextSize);
    }
    engraveTune(abcTune: Tune, tuneNumber: number, lineOffset: number): void {
        var origJazzChords = this.jazzchords;
        var scale: number = this.setupTune(abcTune, tuneNumber);
        // Create all of the element objects that will appear on the page.
        this.constructTuneElements(abcTune);
        //Set the top text now that we know the width
        // Do all the positioning, both horizontally and vertically
        var maxWidth: number = layout(this.renderer, abcTune, this.width, this.space, this.expandToWidest, this.timeBasedLayout);
        //Set the top text now that we know the width
        if (this.expandToWidest && maxWidth > this.width + 1) {
            abcTune.topText = new TopText(abcTune.metaText, abcTune.metaTextInfo, abcTune.formatting, abcTune.lines, maxWidth, this.renderer.isPrint, this.renderer.padding.left, this.renderer.spacing, this.classes.shouldAddClasses, this.getTextSize);
            if (abcTune.lines && abcTune.lines.length > 0) {
                var nlines: number = abcTune.lines.length;
                for (var i: number = 0; i < nlines; ++i) {
                    var entry: Lines = abcTune.lines[i];
                    if (entry.nonMusic) {
                        if (entry.nonMusic.rows && entry.nonMusic.rows.length > 0) {
                            var nRows = entry.nonMusic.rows.length;
                            for (var j: number = 0; j < nRows; ++j) {
                                var thisRow = entry.nonMusic.rows[j];
                                // Recenter the element if it's a subtitle or centered text
                                if (thisRow.left) {
                                    if (entry.subtitle) {
                                        thisRow.left = maxWidth / 2 + this.renderer.padding.left;
                                    }
                                    else {
                                        if (entry.text && entry.text.length > 0) {
                                            if (entry.text[0].center) {
                                                thisRow.left = maxWidth / 2 + this.renderer.padding.left;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        // Deal with tablature for staff
        if (abcTune.tablatures) {
            tablatures.layoutTablatures(this.renderer, abcTune);
        }
        // Do all the writing to the SVG
        var ret = draw(this.renderer, this.classes, abcTune, this.width, maxWidth, this.responsive, scale, this.selectTypes, tuneNumber, lineOffset, this.chordGrid);
        this.staffgroups = ret.staffgroups;
        this.selectables = ret.selectables;
        if (this.oneSvgPerLine) {
            var div: ParentNode = this.renderer.paper.svg.parentNode;
            this.svgs = splitSvgIntoLines(this.renderer, div, abcTune.metaText.title, this.responsive, scale);
        }
        else {
            this.svgs = [this.renderer.paper.svg];
        }
        setupSelection(this, this.svgs);
        this.jazzchords = origJazzChords;
    }
    getDim(historyEl: any) {
        // Get the dimensions on demand because the getBBox call is expensive.
        if (!historyEl.dim) {
            var box: SVGRect = historyEl.svgEl.getBBox();
            historyEl.dim = { left: Math.round(box.x), top: Math.round(box.y), right: Math.round(box.x + box.width), bottom: Math.round(box.y + box.height) };
        }
        return historyEl.dim;
    }
    addSelectListener(clickListener: any): void {
        this.listeners[this.listeners.length] = clickListener;
    }
}
function splitSvgIntoLines(renderer: Renderer, output: ParentNode, title: string, responsive, scale: number): any[] {
    // Each line is a top level <g> in the svg. To split it into separate
    // svgs iterate through each of those and put them in a new svg. Since
    // they are placed absolutely, the viewBox needs to be manipulated to
    // get the correct vertical positioning.
    // We copy all the attributes from the original svg except for the aria-label
    // since we want that to include a count. And the height is now a fraction of the original svg.
    if (!title)
        title = "Untitled";
    var source: SVGSVGElement = output.querySelector("svg");
    if (responsive === "resize")
        output.style.paddingBottom = "";
    var style: HTMLStyleElement = source.querySelector("style");
    var width: string | number = responsive === "resize" ? source.viewBox.baseVal.width : source.getAttribute("width");
    var sections: NodeListOf<Element> = output.querySelectorAll("svg > g"); // each section is a line, or the top matter or the bottom matter, or text that has been inserted.
    var nextTop: number = 0; // There are often gaps between the elements for spacing, so the actual top and height needs to be inferred.
    var wrappers = []; // Create all the elements and place them at once because we use the current svg to get data. It would disappear after placing the first line.
    var svgs = [];
    for (var i: number = 0; i < sections.length; i++) {
        var section = sections[i];
        var box = section.getBBox();
        var gapBetweenLines: number = box.y - nextTop; // take the margin into account
        var height = box.height + gapBetweenLines;
        var wrapper: HTMLDivElement = document.createElement("div");
        var divStyles = "overflow: hidden;";
        if (responsive !== "resize")
            divStyles += "height:" + height * scale + "px;";
        wrapper.setAttribute("style", divStyles);
        var svg: Element = duplicateSvg(source);
        var fullTitle: string = 'Sheet Music for "' + title + '" section ' + (i + 1);
        svg.setAttribute("aria-label", fullTitle);
        if (responsive !== "resize")
            svg.setAttribute("height", height.toString());
        if (responsive === "resize")
            svg.style.position = "";
        // TODO-PER: Hack! Not sure why this is needed.
        var viewBoxHeight = renderer.firefox112 ? height + 1 : height;
        svg.setAttribute("viewBox", "0 " + nextTop + " " + width + " " + viewBoxHeight);
        if (style)
            svg.appendChild(style.cloneNode(true));
        var titleEl: HTMLTitleElement = document.createElement("title");
        titleEl.innerText = fullTitle;
        svg.appendChild(titleEl);
        svg.appendChild(section);
        wrapper.appendChild(svg);
        svgs.push(svg);
        output.appendChild(wrapper);
        //wrappers.push(wrapper)
        nextTop = box.y + box.height;
    }
    // for (i = 0; i < wrappers.length; i++)
    // 	output.appendChild(wrappers[i])
    output.removeChild(source);
    return svgs;
}
function duplicateSvg(source: SVGSVGElement): Element {
    var svgNS: string = "http://www.w3.org/2000/svg";
    var svg: Element = document.createElementNS(svgNS, "svg");
    for (var i: number = 0; i < source.attributes.length; i++) {
        var attr = source.attributes[i];
        if (attr.name !== "height" && attr.name != "aria-label")
            svg.setAttribute(attr.name, attr.value);
    }
    return svg;
}
export default EngraverController;
