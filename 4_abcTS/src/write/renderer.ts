//    abc_renderer.js: API to render to SVG/Raphael/whatever rendering engine
import spacing from "./helpers/spacing";
import Svg from "./svg";
class Renderer {
    paddingOverride: PaddingOverride;
    paper: Svg;
    controller: EngraverController = null;
    /** renderer's padding is managed by the controller */
    padding: Padding = {} as Padding;
    y: number = 0;
    abctune: Tune = null;
    path: any = null;
    isPrint: boolean = false;
    lineThickness: number = 0;
    spacing: Spacing = {} as Spacing;
    minPadding: number = 0;
    space: number = 3 * spacing.SPACE;
    firefox112: boolean = typeof navigator !== "undefined" && navigator.userAgent.indexOf("Firefox/112.0") >= 0;

    constructor(paper: HTMLDivElement) {
        this.paper = new Svg(paper);
        this.reset();
    }
    reset(): void {
        this.paper.clear();
        this.y = 0;
        this.abctune = null;
        this.path = null;
        this.isPrint = false;
        this.lineThickness = 0;
        this.initVerticalSpace();
    }
    newTune(abcTune: Tune): void {
        this.abctune = abcTune; // TODO-PER: this is just to get the font info.
        this.setVerticalSpace(abcTune.formatting);
        //this.measureNumber = null;
        //this.noteNumber = null;
        this.isPrint = abcTune.media === "print";
        this.setPadding(abcTune);
    }
    setLineThickness(lineThickness): void {
        this.lineThickness = lineThickness;
    }
    setPaddingOverride(params: any): void {
        this.paddingOverride = {
            top: params.paddingtop,
            bottom: params.paddingbottom,
            right: params.paddingright,
            left: params.paddingleft,
        };
    }
    setPadding(abctune: Tune): void {
        // If the padding is set in the tune, then use that.
        // Otherwise, if the padding is set in the override, use that.
        // Otherwise, use the defaults (there are a different set of defaults for screen and print.)
        const setPaddingVariable = (paddingKey: string, formattingKey: string, printDefault: number, screenDefault: number): void => {
            if (abctune.formatting[formattingKey] !== undefined)
                this.padding[paddingKey] = abctune.formatting[formattingKey];
            else if (this.paddingOverride && this.paddingOverride[paddingKey] !== undefined)
                this.padding[paddingKey] = this.paddingOverride[paddingKey];
            else if (this.isPrint)
                this.padding[paddingKey] = printDefault;
            else
                this.padding[paddingKey] = screenDefault;
        };
        // 1cm x 0.393701in/cm x 72pt/in x 1.33px/pt = 38px
        // 1.8cm x 0.393701in/cm x 72pt/in x 1.33px/pt = 68px
        setPaddingVariable("top", "topmargin", 38, 15);
        setPaddingVariable("bottom", "botmargin", 38, 15);
        setPaddingVariable("left", "leftmargin", 68, 15);
        setPaddingVariable("right", "rightmargin", 68, 15);
    }
    /**
     * Some of the items on the page are not scaled, so adjust them in the opposite direction of scaling to cancel out the scaling.
     * @param {float} scale
     */
    adjustNonScaledItems(scale: number): void {
        this.padding.top /= scale;
        this.padding.bottom /= scale;
        this.padding.left /= scale;
        this.padding.right /= scale;
        if (this.abctune && this.abctune.formatting) {
            if (this.abctune.formatting.headerfont)
                this.abctune.formatting.headerfont.size /= scale;
            if (this.abctune.formatting.footerfont)
                this.abctune.formatting.footerfont.size /= scale;
        }
    }
    /**
     * Set the the values for all the configurable vertical space options.
     */
    initVerticalSpace(): void {
        // conversion: 37.7953 = conversion factor for cm to px.
        // All of the following values are in px.
        this.spacing = {
            composer: 7.56, // Set the vertical space above the composer.
            graceBefore: 8.67, // Define the space before, inside and after the grace notes.
            graceInside: 10.67,
            graceAfter: 16,
            info: 0, // Set the vertical space above the infoline.
            lineSkipFactor: 1.1, // Set the factor for spacing between lines of text. (multiply this by the font size)
            music: 7.56, // Set the vertical space above the first staff.
            paragraphSkipFactor: 0.4, // Set the factor for spacing between text paragraphs. (multiply this by the font size)
            parts: 11.33, // Set the vertical space above a new part.
            slurHeight: 1.0, // Set the slur height factor.
            staffSeparation: 61.33, // Do not put a staff system closer than <unit> from the previous system.
            staffTopMargin: 0,
            stemHeight: 26.67 + 10, // Set the stem height.
            subtitle: 3.78, // Set the vertical space above the subtitle.
            systemStaffSeparation: 48, // Do not place the staves closer than <unit> inside a system. * This values applies to all staves when in the tune header. Otherwise, it applies to the next staff
            text: 18.9, // Set the vertical space above the history.
            title: 7.56, // Set the vertical space above the title.
            top: 30.24, //Set the vertical space above the tunes and on the top of the continuation pages.
            vocal: 0, // Set the vertical space above the lyrics under the staves.
            words: 0, // Set the vertical space above the lyrics at the end of the tune.
        };
    }
    setVerticalSpace(formatting: Formatting): void {
        // conversion from pts to px 4/3
        const f = (val: number): number => (val !== undefined ? (val * 4) / 3 : undefined);
        if (formatting.staffsep !== undefined)
            this.spacing.staffSeparation = f(formatting.staffsep);
        if (formatting.composerspace !== undefined)
            this.spacing.composer = f(formatting.composerspace);
        if (formatting.partsspace !== undefined)
            this.spacing.parts = f(formatting.partsspace);
        if (formatting.textspace !== undefined)
            this.spacing.text = f(formatting.textspace);
        if (formatting.musicspace !== undefined)
            this.spacing.music = f(formatting.musicspace);
        if (formatting.titlespace !== undefined)
            this.spacing.title = f(formatting.titlespace);
        if (formatting.sysstaffsep !== undefined)
            this.spacing.systemStaffSeparation = f(formatting.sysstaffsep);
        if (formatting.stafftopmargin !== undefined)
            this.spacing.staffTopMargin = f(formatting.stafftopmargin);
        if (formatting.subtitlespace !== undefined)
            this.spacing.subtitle = f(formatting.subtitlespace);
        if (formatting.topspace !== undefined)
            this.spacing.top = f(formatting.topspace);
        if (formatting.vocalspace !== undefined)
            this.spacing.vocal = f(formatting.vocalspace);
        if (formatting.wordsspace !== undefined)
            this.spacing.words = f(formatting.wordsspace);
    }
    /**
     * Calculates the y for a given pitch value (relative to the stave the renderer is currently printing)
     * @param {number} ofs pitch value (bottom C on a G clef = 0, D=1, etc.)
     */
    calcY(ofs: number): number {
        return this.y - ofs * spacing.STEP;
    }
    yToPitch(ofs): number {
        return ofs / spacing.STEP;
    }
    moveY(em: number, numLines: number = 1): void {
        this.y += em * numLines;
    }
    absolutemoveY(y): void {
        this.y = y;
    }
}
export default Renderer;
