import addTextIf from "../add-text-if";
import richText from "./rich-text";

class TopText {
	public rows: any[] = [];

	constructor(metaText: any, metaTextInfo: any, formatting: any, lines: any[], width: number, isPrint: boolean, paddingLeft: number, spacing: any, shouldAddClasses: boolean, getTextSize: any) {
		this.rows = [];

		if (metaText.header && isPrint) {
			const headerTextHeight = getTextSize.calc("X", "headerfont", 'abcjs-header abcjs-meta-top').height;
			addTextIf(this.rows, { marginLeft: paddingLeft, text: metaText.header.left, font: 'headerfont', klass: 'header meta-top', marginTop: -headerTextHeight, info: metaTextInfo.header, name: "header" }, getTextSize);
			addTextIf(this.rows, { marginLeft: paddingLeft + width / 2, text: metaText.header.center, font: 'headerfont', klass: 'header meta-top', marginTop: -headerTextHeight, anchor: 'middle', info: metaTextInfo.header, name: "header" }, getTextSize);
			addTextIf(this.rows, { marginLeft: paddingLeft + width, text: metaText.header.right, font: 'headerfont', klass: 'header meta-top', marginTop: -headerTextHeight, anchor: 'end', info: metaTextInfo.header, name: "header" }, getTextSize);
		}
		if (isPrint)
			this.rows.push({ move: spacing.top });

		const tAnchor = formatting.titleleft ? 'start' : 'middle';
		const tLeft = formatting.titleleft ? paddingLeft : paddingLeft + width / 2;

		if (metaText.title) {
			const klass = shouldAddClasses ? 'abcjs-title' : '';
			richText(this.rows, metaText.title, "titlefont", klass, 'title', tLeft, { marginTop: spacing.title, anchor: tAnchor, absElemType: "title", info: metaTextInfo.title }, getTextSize);
		}
		if (lines.length) {
			let index = 0;
			while (index < lines.length && lines[index].subtitle) {
				const klass = shouldAddClasses ? 'abcjs-text abcjs-subtitle' : '';
				richText(this.rows, lines[index].subtitle.text, "subtitlefont", klass, 'subtitle', tLeft, { marginTop: spacing.subtitle, anchor: tAnchor, absElemType: "subtitle", info: lines[index].subtitle }, getTextSize);
				index++;
			}
		}

		if (metaText.rhythm || metaText.origin || metaText.composer) {
			this.rows.push({ move: spacing.composer });
			if (metaText.rhythm && metaText.rhythm.length > 0) {
				const noMove = !!(metaText.composer || metaText.origin);
				const klass = shouldAddClasses ? 'abcjs-rhythm' : '';
				addTextIf(this.rows, { marginLeft: paddingLeft, text: metaText.rhythm, font: 'infofont', klass: klass, absElemType: "rhythm", noMove: noMove, info: metaTextInfo.rhythm, name: "rhythm" }, getTextSize);
			}

			let composerLine = metaText.composer ? metaText.composer : '';
			if (metaText.origin) {
				if (typeof composerLine === 'string' && typeof metaText.origin === 'string')
					composerLine += ' (' + metaText.origin + ')';
				else if (typeof composerLine === 'string' && typeof metaText.origin !== 'string') {
					composerLine = [{ text: composerLine }];
					composerLine.push({ text: " (" });
					composerLine = composerLine.concat(metaText.origin);
					composerLine.push({ text: ")" });
				} else {
					composerLine.push({ text: " (" });
					composerLine = (composerLine as any[]).concat(metaText.origin);
					composerLine.push({ text: ")" });
				}
			}
			if (composerLine) {
				const klass = shouldAddClasses ? 'abcjs-composer' : '';
				richText(this.rows, composerLine, 'composerfont', klass, "composer", paddingLeft + width, { anchor: "end", absElemType: "composer", info: metaTextInfo.composer, ingroup: true }, getTextSize);
			}
		}

		if (metaText.author && metaText.author.length > 0) {
			const klass = shouldAddClasses ? 'abcjs-author' : '';
			richText(this.rows, metaText.author, 'composerfont', klass, "author", paddingLeft + width, { anchor: "end", absElemType: "author", info: metaTextInfo.author }, getTextSize);
		}

		if (metaText.partOrder && metaText.partOrder.length > 0) {
			const klass = shouldAddClasses ? 'abcjs-part-order' : '';
			richText(this.rows, metaText.partOrder, 'partsfont', klass, "part-order", paddingLeft, { absElemType: "partOrder", info: metaTextInfo.partOrder, anchor: 'start' }, getTextSize);
		}
	}
}

export default TopText;
