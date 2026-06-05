const setClass = (elemset: SVGElement[], addClass: string, removeClass: string, color: string): void => {
	if (!elemset)
		return;
	for (let i = 0; i < elemset.length; i++) {
		const el = elemset[i];
		let attr = el.getAttribute("highlight");
		if (!attr) attr = "fill";
		el.setAttribute(attr, color);
		let kls = el.getAttribute("class") || "";
		kls = kls.replace(new RegExp(removeClass, 'g'), "").trim();
		kls = kls.replace(new RegExp(addClass, 'g'), "").trim();
		if (addClass.length > 0) {
			if (kls.length > 0 && kls[kls.length - 1] !== ' ') kls += " ";
			kls += addClass;
		}
		el.setAttribute("class", kls);
	}
};

export default setClass;
