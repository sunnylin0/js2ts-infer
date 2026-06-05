function findNumber(klass: string, match: string, target: any, name: string): void {
	if (klass.indexOf(match) === 0) {
		const value = klass.replace(match, '');
		const num = parseInt(value, 10);
		if ('' + num === value)
			target[name] = num;
	}
}

interface AnalysisResult {
	classes: string[];
	analysis: {
		voice?: number;
		line?: number;
		measure?: number;
		staffPos?: any;
		name?: string;
		clickedName?: string;
		parentClasses?: DOMTokenList;
		clickedClasses?: DOMTokenList;
		selectableElement?: SVGElement;
	};
}

function createAnalysis(target: any, ev: any): AnalysisResult {
	const classes: string[] = [];
	if (target.absEl && target.absEl.elemset) {
		const classObj: Record<string, boolean> = {};
		for (let j = 0; j < target.absEl.elemset.length; j++) {
			const es = target.absEl.elemset[j];
			if (es) {
				const klassAttr = es.getAttribute("class");
				if (klassAttr) {
					const klass = klassAttr.split(' ');
					for (let k = 0; k < klass.length; k++)
						classObj[klass[k]] = true;
				}
			}
		}
		const keys = Object.keys(classObj);
		for (let kk = 0; kk < keys.length; kk++)
			classes.push(keys[kk]);
	}
	const analysis: any = {};
	for (let ii = 0; ii < classes.length; ii++) {
		findNumber(classes[ii], "abcjs-v", analysis, "voice");
		findNumber(classes[ii], "abcjs-l", analysis, "line");
		findNumber(classes[ii], "abcjs-m", analysis, "measure");
	}
	if (target.staffPos)
		analysis.staffPos = target.staffPos;

	let closest = ev.target as any;
	while (closest && closest.dataset && !closest.dataset.name && closest.tagName.toLowerCase() !== 'svg')
		closest = closest.parentNode;

	let parent = ev.target as any;
	while (parent && parent.dataset && !parent.dataset.index && parent.tagName.toLowerCase() !== 'svg')
		parent = parent.parentNode;

	if (parent && parent.dataset) {
		analysis.name = parent.dataset.name;
		analysis.clickedName = closest ? closest.dataset.name : undefined;
		analysis.parentClasses = parent.classList;
	}
	if (closest && closest.classList)
		analysis.clickedClasses = closest.classList;

	analysis.selectableElement = target.svgEl;
	return { classes: classes, analysis: analysis };
}

export default createAnalysis;
