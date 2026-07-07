function setPaperSize(renderer: Renderer, maxwidth: number, scale: number, responsive: any): void {
    const w: number = (maxwidth + renderer.padding.left + renderer.padding.right) * scale;
    let h: number = (renderer.y + renderer.padding.bottom) * scale;
    if (renderer.isPrint)
        h = Math.max(h, 1056); // 11in x 72pt/in x 1.33px/pt
    // TODO-PER: We are letting the page get as long as it needs now, but eventually that should go to a second page.
    // for accessibility
    if (renderer.ariaLabel !== '') {
        let text: string = "Sheet Music";
        if (renderer.abctune && renderer.abctune.metaText && renderer.abctune.metaText.title)
            text += ' for "' + renderer.abctune.metaText.title + '"';
        renderer.paper.setTitle(text);
        const label: string = renderer.ariaLabel ? renderer.ariaLabel : text;
        renderer.paper.setAttribute("aria-label", label);
    }
    // for dragging - don't select during drag
    const styles: Array<string> = [
        "-webkit-touch-callout: none;",
        "-webkit-user-select: none;",
        "-khtml-user-select: none;",
        "-moz-user-select: none;",
        "-ms-user-select: none;",
        "user-select: none;"
    ];
    renderer.paper.insertStyles(".abcjs-dragging-in-progress text, .abcjs-dragging-in-progress tspan {" + styles.join(" ") + "}");
    const parentStyles = { overflow: "hidden" };
    if (responsive === 'resize') {
        renderer.paper.setResponsiveWidth(w, h);
    }
    else {
        parentStyles.width = "";
        parentStyles.height = h + "px";
        if (scale < 1) {
            parentStyles.width = w + "px";
            renderer.paper.setSize(w / scale, h / scale);
        }
        else
            renderer.paper.setSize(w, h);
    }
    renderer.paper.setScale(scale);
    renderer.paper.setParentStyles(parentStyles);
}
export default setPaperSize;
