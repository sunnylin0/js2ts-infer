import createAnalysis from './create-analysis';

function findSelectableElement(this: any, event: any): any {
	let selectable = event.target as any;
	while (selectable && selectable.attributes && selectable.tagName.toLowerCase() !== 'svg' && !selectable.attributes.selectable) {
		selectable = selectable.parentNode;
	}
	if (selectable && selectable.attributes && selectable.attributes.selectable) {
		const indexAttr = selectable.attributes['data-index'];
		if (indexAttr) {
			let index = indexAttr.nodeValue;
			if (index) {
				const idx = parseInt(index, 10);
				if (idx >= 0 && idx < this.selectables.length) {
					const element = this.selectables[idx];
					const ret = createAnalysis(element, event);
					(ret as any).index = idx;
					(ret as any).element = element;
					return ret;
				}
			}
		}
	}
	return null;
}

export default findSelectableElement;
