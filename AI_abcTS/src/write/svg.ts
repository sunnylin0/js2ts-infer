//    abc_voice_element.js: Definition of the VoiceElement class.

const svgNS = "http://www.w3.org/2000/svg";

const sizeCache: Record<string, { width: number; height: number }> = {};

function createSvg(): SVGSVGElement {
	const svg = document.createElementNS(svgNS, "svg") as unknown as SVGSVGElement;
	svg.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
	svg.setAttribute("role", "img"); // for accessibility
	svg.setAttribute("fill", "currentColor"); // for automatically picking up dark mode and high contrast
	svg.setAttribute("stroke", "currentColor"); // for automatically picking up dark mode and high contrast
	return svg;
}

function constructHLine(x1: number, y1: number, x2: number): string {
	const len = x2 - x1;
	return "M " + x1 + " " + y1 + " l " + len + " " + 0 + " l " + 0 + " " + 1 + " " + " l " + -len + " " + 0 + " " + " z ";
}

function constructVLine(x1: number, y1: number, y2: number): string {
	const len = y2 - y1;
	return "M " + x1 + " " + y1 + " l " + 0 + " " + len + " l " + 1 + " " + 0 + " " + " l " + 0 + " " + -len + " " + " z ";
}

class Svg {
	public svg: SVGSVGElement;
	public currentGroup: SVGElement[] = [];
	private dummySvg: SVGSVGElement | null = null;

	constructor(wrapper: HTMLElement) {
		this.svg = createSvg();
		wrapper.appendChild(this.svg);
	}

	public clear(): void {
		if (this.svg) {
			const wrapper = this.svg.parentNode as HTMLElement;
			this.svg = createSvg();
			this.currentGroup = [];
			if (wrapper) {
				// TODO-PER: If the wrapper is not present, then the underlying div was pulled out from under this instance. It's possible that is still useful (for creating the music off page?)
				wrapper.innerHTML = "";
				wrapper.appendChild(this.svg);
			}
		}
	}

	public setTitle(title: string): void {
		const titleEl = document.createElement("title");
		const titleNode = document.createTextNode(title);
		titleEl.appendChild(titleNode);
		this.svg.insertBefore(titleEl, this.svg.firstChild);
	}

	public setResponsiveWidth(w: number, h: number): void {
		// this technique is from: http://thenewcode.com/744/Make-SVG-Responsive, thx to https://github.com/iantresman
		this.svg.setAttribute("viewBox", "0 0 " + w + " " + h);
		this.svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
		this.svg.removeAttribute("height");
		this.svg.removeAttribute("width");
		this.svg.style.display = "inline-block";
		this.svg.style.position = "absolute";
		this.svg.style.top = "0";
		this.svg.style.left = "0";

		if (this.svg.parentNode) {
			const parent = this.svg.parentNode as HTMLElement;
			const cls = parent.getAttribute("class");
			if (!cls) parent.setAttribute("class", "abcjs-container");
			else if (cls.indexOf("abcjs-container") < 0) parent.setAttribute("class", cls + " abcjs-container");
			parent.style.display = "inline-block";
			parent.style.position = "relative";
			parent.style.width = "100%";
			// PER: I changed the padding from 100% to this through trial and error.
			// The example was using a square image, but this music might be either wider or taller.
			const padding = (h / w) * 100;
			parent.style.paddingBottom = padding + "%";
			parent.style.verticalAlign = "middle";
			parent.style.overflow = "hidden";
		}
	}

	public setSize(w: number, h: number): void {
		this.svg.setAttribute("width", w.toString());
		this.svg.setAttribute("height", h.toString());
	}

	public setAttribute(attr: string, value: string): void {
		this.svg.setAttribute(attr, value);
	}

	public setScale(scale: number): void {
		if (scale !== 1) {
			const s = "scale(" + scale + "," + scale + ")";
			this.svg.style.transform = s;
			(this.svg.style as any)["-ms-transform"] = s;
			(this.svg.style as any)["-webkit-transform"] = s;
			this.svg.style.transformOrigin = "0 0";
			(this.svg.style as any)["-ms-transform-origin-x"] = "0";
			(this.svg.style as any)["-ms-transform-origin-y"] = "0";
			(this.svg.style as any)["-webkit-transform-origin-x"] = "0";
			(this.svg.style as any)["-webkit-transform-origin-y"] = "0";
		} else {
			this.svg.style.transform = "";
			(this.svg.style as any)["-ms-transform"] = "";
			(this.svg.style as any)["-webkit-transform"] = "";
		}
	}

	public insertStyles(styles: string): void {
		const el = document.createElementNS(svgNS, "style");
		el.textContent = styles;
		this.svg.insertBefore(el, this.svg.firstChild); // prepend is not available on older browsers.
		//	this.svg.prepend(el);
	}

	public setParentStyles(attr: Record<string, string>): void {
		// This is needed to get the size right when there is scaling involved.
		for (const key in attr) {
			if (Object.prototype.hasOwnProperty.call(attr, key)) {
				if (this.svg.parentNode) (this.svg.parentNode as HTMLElement).style[key as any] = attr[key];
			}
		}
		// This is the last thing that gets called, so delete the temporary SVG if one was created
		if (this.dummySvg) {
			const body = document.querySelector("body");
			if (body) body.removeChild(this.dummySvg);
			this.dummySvg = null;
		}
	}

	public rect(attr: any): SVGPathElement {
		// This uses path instead of rect so that it can be hollow and the color changes with "fill" instead of "stroke".
		const lines: string[] = [];
		const x1 = attr.x;
		const y1 = attr.y;
		const x2 = attr.x + attr.width;
		const y2 = attr.y + attr.height;
		lines.push(constructHLine(x1, y1, x2));
		lines.push(constructHLine(x1, y2, x2));
		lines.push(constructVLine(x2, y1, y2));
		lines.push(constructVLine(x1, y2, y1));

		return this.path({ path: lines.join(" "), stroke: "none", "data-name": attr["data-name"] });
	}

	public dottedLine(attr: any): void {
		const el = document.createElementNS(svgNS, "line");
		el.setAttribute("x1", attr.x1);
		el.setAttribute("x2", attr.x2);
		el.setAttribute("y1", attr.y1);
		el.setAttribute("y2", attr.y2);
		el.setAttribute("stroke", attr.stroke);
		el.setAttribute("stroke-dasharray", "5,5");
		this.svg.insertBefore(el, this.svg.firstChild);
	}

	public rectBeneath(attr: any): void {
		const el = document.createElementNS(svgNS, "rect");
		el.setAttribute("x", attr.x);
		el.setAttribute("width", attr.width);
		el.setAttribute("y", attr.y);
		el.setAttribute("height", attr.height);
		if (attr.stroke) el.setAttribute("stroke", attr.stroke);
		if (attr["stroke-opacity"]) el.setAttribute("stroke-opacity", attr["stroke-opacity"]);
		if (attr.fill) el.setAttribute("fill", attr.fill);
		if (attr["fill-opacity"]) el.setAttribute("fill-opacity", attr["fill-opacity"]);
		this.svg.insertBefore(el, this.svg.firstChild);
	}

	public text(text: string | number, attr: any, target?: SVGElement, spanAttr?: any): SVGTextElement {
		const el = document.createElementNS(svgNS, "text");
		el.setAttribute("stroke", "none");
		for (const key in attr) {
			if (Object.prototype.hasOwnProperty.call(attr, key)) {
				el.setAttribute(key, attr[key]);
			}
		}
		const isFreeText = attr["data-name"] === "free-text";
		const lines = ("" + text).split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (isFreeText && lines[i] === "") {
				// Don't draw empty lines
				continue;
			}

			const line = document.createElementNS(svgNS, "tspan");
			if (spanAttr) {
				for (const skey in spanAttr) {
					if (Object.prototype.hasOwnProperty.call(spanAttr, skey)) {
						line.setAttribute(skey, spanAttr[skey]);
					}
				}
			}
			line.setAttribute("x", (attr.x ? attr.x : 0).toString());
			if (i !== 0) line.setAttribute("dy", "1.2em");
			if (lines[i].indexOf("\x03") !== -1) {
				const parts = lines[i].split("\x03");
				line.textContent = parts[0];
				if (parts[1]) {
					const ts2 = document.createElementNS(svgNS, "tspan");
					ts2.setAttribute("dy", "-0.3em");
					ts2.setAttribute("style", "font-size:0.7em");
					ts2.textContent = parts[1];
					line.appendChild(ts2);
				}
				if (parts[2]) {
					const dist = parts[1] ? "0.4em" : "0.1em";
					const ts3 = document.createElementNS(svgNS, "tspan");
					ts3.setAttribute("dy", dist);
					ts3.setAttribute("style", "font-size:0.7em");
					ts3.textContent = parts[2];
					line.appendChild(ts3);
				}
			} else {
				// MAE 9 May 2025 - For improved block text
				if (isFreeText) {
					// Fixes issue where blank lines in text blocks didn't take up any vertical
					if (lines[i].trim() === "") {
						line.innerHTML = "&nbsp;";
					} else {
						line.textContent = lines[i];
					}
				} else {
					line.textContent = lines[i];
				}
			}
			el.appendChild(line);
		}
		if (target) target.appendChild(el);
		else this.append(el);
		return el;
	}

	public richTextLine(phrases: any[], x: number, y: number, klass: string, anchor: string, target?: SVGElement): SVGTextElement {
		const el = document.createElementNS(svgNS, "text");
		el.setAttribute("stroke", "none");
		el.setAttribute("class", klass);
		el.setAttribute("x", x.toString());
		el.setAttribute("y", y.toString());
		el.setAttribute("text-anchor", anchor);
		el.setAttribute("dominant-baseline", "middle");

		for (let i = 0; i < phrases.length; i++) {
			const phrase = phrases[i];
			const tspan = document.createElementNS(svgNS, "tspan");
			const attrs = Object.keys(phrase.attrs);
			for (let j = 0; j < attrs.length; j++) {
				const value = phrase.attrs[attrs[j]];
				if (value !== "") tspan.setAttribute(attrs[j], value);
			}
			tspan.textContent = phrase.content;

			el.appendChild(tspan);
		}

		if (target) target.appendChild(el);
		else this.append(el);
		return el;
	}

	public guessWidth(text: string | number, attr: any): { width: number; height: number } {
		const svg = this.createDummySvg();
		const el = this.text(text, attr, svg);
		let size: { width: number; height: number };
		try {
			const bbox = el.getBBox();
			if (isNaN(bbox.height) || !bbox.height)
				// TODO-PER: I don't think this can happen unless there isn't a browser at all.
				size = { width: attr["font-size"] / 2, height: attr["font-size"] + 2 }; // Just a wild guess.
			else size = { width: bbox.width, height: bbox.height };
		} catch (ex) {
			size = { width: attr["font-size"] / 2, height: attr["font-size"] + 2 }; // Just a wild guess.
		}
		svg.removeChild(el);
		return size;
	}

	public createDummySvg(): SVGSVGElement {
		if (!this.dummySvg) {
			this.dummySvg = createSvg();
			const styles = [
				"display: block !important;",
				"height: 1px;",
				"width: 1px;",
				"position: absolute;"];
			this.dummySvg.setAttribute("style", styles.join(""));
			const body = document.querySelector("body");
			if (body) body.appendChild(this.dummySvg);
		}

		return this.dummySvg;
	}

	public getTextSize(text: string | number, attr: any, el?: SVGTextElement): { width: number; height: number } {
		if (typeof text === "number") text = "" + text;
		if (!text || (text as string).match(/^\s+$/)) return { width: 0, height: 0 };
		let key: string | null = null;
		if ((text as string).length < 20) {
			// The short text tends to be repetitive and getBBox is really slow, so lets cache.
			key = (text as string) + JSON.stringify(attr);
			if (sizeCache[key]) return sizeCache[key];
		}
		const removeLater = !el;
		if (!el) el = this.text(text, attr);
		let size: { width: number; height: number };
		try {
			const bbox = el.getBBox();
			if (isNaN(bbox.height) || !bbox.height) size = this.guessWidth(text, attr);
			else size = { width: bbox.width, height: bbox.height };
		} catch (ex) {
			size = this.guessWidth(text, attr);
		}
		if (removeLater) {
			if (this.currentGroup.length > 0) this.currentGroup[0].removeChild(el!);
			else this.svg.removeChild(el!);
		}
		if (key) sizeCache[key] = size;
		return size;
	}

	public openGroup(options?: any): SVGGElement {
		options = options ? options : {};
		const el = document.createElementNS(svgNS, "g");
		if (options.klass) el.setAttribute("class", options.klass);
		if (options.fill) el.setAttribute("fill", options.fill);
		if (options.stroke) el.setAttribute("stroke", options.stroke);
		if (options["data-name"]) el.setAttribute("data-name", options["data-name"]);

		if (options.prepend) this.prepend(el);
		else this.append(el);
		this.currentGroup.unshift(el);
		return el;
	}

	public closeGroup(): SVGGElement | null {
		const g = this.currentGroup.shift() as SVGGElement | undefined;
		if (g && g.children.length === 0) {
			// If nothing was added to the group it is because all the elements were invisible. We don't need the group, then.
			if (g.parentElement) g.parentElement.removeChild(g);
			return null;
		}
		return g || null;
	}

	public path(attr: any): SVGPathElement {
		const el = document.createElementNS(svgNS, "path");
		for (const key in attr) {
			if (Object.prototype.hasOwnProperty.call(attr, key)) {
				if (key === "path") el.setAttributeNS(null, "d", attr.path);
				else if (key === "klass") el.setAttributeNS(null, "class", attr[key]);
				else if (attr[key] !== undefined) el.setAttributeNS(null, key, attr[key]);
			}
		}
		this.append(el);
		return el;
	}

	public pathToBack(attr: any): SVGPathElement {
		const el = document.createElementNS(svgNS, "path");
		for (const key in attr) {
			if (Object.prototype.hasOwnProperty.call(attr, key)) {
				if (key === "path") el.setAttributeNS(null, "d", attr.path);
				else if (key === "klass") el.setAttributeNS(null, "class", attr[key]);
				else el.setAttributeNS(null, key, attr[key]);
			}
		}
		this.prepend(el);
		return el;
	}

	public lineToBack(attr: any): SVGLineElement {
		const el = document.createElementNS(svgNS, "line");
		const keys = Object.keys(attr);
		for (let i = 0; i < keys.length; i++) el.setAttribute(keys[i], attr[keys[i]]);
		this.prepend(el);
		return el;
	}

	public append(el: SVGElement): void {
		if (this.currentGroup.length > 0) this.currentGroup[0].appendChild(el);
		else this.svg.appendChild(el);
	}

	public prepend(el: SVGElement): void {
		// The entire group is prepended, so don't prepend the individual elements.
		if (this.currentGroup.length > 0) this.currentGroup[0].appendChild(el);
		else this.svg.insertBefore(el, this.svg.firstChild);
	}

	public setAttributeOnElement(el: SVGElement, attr: Record<string, string>): void {
		for (const key in attr) {
			if (Object.prototype.hasOwnProperty.call(attr, key)) {
				el.setAttributeNS(null, key, attr[key]);
			}
		}
	}

	public moveElementToChild(parent: SVGElement, child: SVGElement): void {
		parent.appendChild(child);
	}
}

export default Svg;
