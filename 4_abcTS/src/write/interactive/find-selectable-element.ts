import createAnalysis from './create-analysis';
function findSelectableElement(event) {
    let selectable = event.target;
    while (selectable && selectable.attributes && selectable.tagName.toLowerCase() !== 'svg' && !selectable.attributes.selectable) {
        selectable = selectable.parentNode;
    }
    if (selectable && selectable.attributes && selectable.attributes.selectable) {
        const indexAttr = selectable.attributes['data-index'];
        if (indexAttr) {
            let index = indexAttr.nodeValue;
            if (index) {
                const idx: number = parseInt(index, 10);
                if (idx >= 0 && idx < this.selectables.length) {
                    const element = this.selectables[idx];
                    const ret = createAnalysis(element, event);
                    ret.index = idx;
                    ret.element = element;
                    return ret;
                }
            }
        }
    }
    return null;
}
export default findSelectableElement;
