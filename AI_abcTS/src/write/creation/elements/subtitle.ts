class Subtitle {
	public rows: any[] = [];

	constructor(spaceAbove: number, formatting: any, info: any, center: number, paddingLeft: number, getTextSize: any) {
		this.rows = [];
		if (spaceAbove)
			this.rows.push({ move: spaceAbove });

		const tAnchor = formatting.titleleft ? 'start' : 'middle';
		const tLeft = formatting.titleleft ? paddingLeft : center;
		this.rows.push({ left: tLeft, text: info.text, font: 'subtitlefont', klass: 'text subtitle', anchor: tAnchor, startChar: info.startChar, endChar: info.endChar, absElemType: "subtitle", name: "subtitle" });

		const size = getTextSize.calc(info.text, 'subtitlefont', 'text subtitle');
		this.rows.push({ move: size.height });
	}
}

export default Subtitle;
