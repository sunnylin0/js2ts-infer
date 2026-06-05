import layoutVoiceElements from './voice-elements';

function checkLastBarX(voices: any[]): void {
	let maxX = 0;
	for (let i = 0; i < voices.length; i++) {
		const curVoice = voices[i];
		if (curVoice.children.length > 0) {
			const lastChild = curVoice.children.length - 1;
			const maxChild = curVoice.children[lastChild];
			if (maxChild.abcelem.el_type === 'bar') {
				const barX = maxChild.children[0].x;
				if (barX > maxX) {
					maxX = barX;
				} else {
					maxChild.children[0].x = maxX;
				}
			}
		}
	}
}

const layoutStaffGroup = function (spacing: number, minPadding: number, debug: boolean, staffGroup: any, leftEdge: number): { spacingUnits: number, minSpace: number } {
	const epsilon = 0.0000001; // Fudging for inexactness of floating point math.
	let spacingunits = 0; // number of times we will have ended up using the spacing distance (as opposed to fixed width distances)
	let minspace = 1000; // a big number to start off with - used to find out what the smallest space between two notes is

	let x = leftEdge;
	staffGroup.startx = x;
	let i: number;

	let currentduration = 0;
	if (debug) console.log("init layout", spacing);
	for (i = 0; i < staffGroup.voices.length; i++) {
		layoutVoiceElements.beginLayout(x, staffGroup.voices[i]);
	}

	let spacingunit = 0; // number of spacingunits coming from the previously laid out element to this one
	while (!finished(staffGroup.voices)) {
		// find first duration level to be laid out among candidates across voices
		let candidateDuration: number | null = null;
		for (i = 0; i < staffGroup.voices.length; i++) {
			if (!layoutVoiceElements.layoutEnded(staffGroup.voices[i]) && (candidateDuration === null || getDurationIndex(staffGroup.voices[i]) < candidateDuration))
				candidateDuration = getDurationIndex(staffGroup.voices[i]);
		}
		currentduration = candidateDuration || 0;

		// isolate voices at current duration level
		const currentvoices = [];
		const othervoices = [];
		for (i = 0; i < staffGroup.voices.length; i++) {
			const durationIndex = getDurationIndex(staffGroup.voices[i]);
			// PER: Because of the inexactness of JS floating point math, we just get close.
			if (durationIndex - currentduration > epsilon) {
				othervoices.push(staffGroup.voices[i]);
			} else {
				currentvoices.push(staffGroup.voices[i]);
			}
		}

		// among the current duration level find the one which needs starting furthest right
		spacingunit = 0; // number of spacingunits coming from the previously laid out element to this one
		let spacingduration = 0;
		for (i = 0; i < currentvoices.length; i++) {
			if (layoutVoiceElements.getNextX(currentvoices[i]) > x) {
				x = layoutVoiceElements.getNextX(currentvoices[i]);
				spacingunit = layoutVoiceElements.getSpacingUnits(currentvoices[i]);
				spacingduration = currentvoices[i].spacingduration;
			}
		}
		spacingunits += spacingunit;
		minspace = Math.min(minspace, spacingunit);
		if (debug) console.log("currentduration: ", currentduration, spacingunits, minspace);

		let lastTopVoice: number | undefined = undefined;
		for (i = 0; i < currentvoices.length; i++) {
			const v = currentvoices[i];
			if (v.voicenumber === 0)
				lastTopVoice = i;
			let topVoice = (lastTopVoice !== undefined && currentvoices[lastTopVoice].voicenumber !== v.voicenumber) ? currentvoices[lastTopVoice] : undefined;
			if (!isSameStaff(v, topVoice))
				topVoice = undefined;
			const voicechildx = layoutVoiceElements.layoutOneItem(x, spacing, v, minPadding, topVoice);
			const dx = voicechildx - x;
			if (dx > 0) {
				x = voicechildx; //update x
				for (let j = 0; j < i; j++) { // shift over all previously laid out elements
					layoutVoiceElements.shiftRight(dx, currentvoices[j]);
				}
			}
		}

		// remove the value of already counted spacing units in other voices
		for (i = 0; i < othervoices.length; i++) {
			othervoices[i].spacingduration -= spacingduration;
			layoutVoiceElements.updateNextX(x, spacing, othervoices[i]); // adjust other voices expectations
		}

		// update indexes of currently laid out elems
		for (i = 0; i < currentvoices.length; i++) {
			const voice = currentvoices[i];
			layoutVoiceElements.updateIndices(voice);
		}
	} // finished laying out


	// find the greatest remaining x as a base for the width
	for (i = 0; i < staffGroup.voices.length; i++) {
		if (layoutVoiceElements.getNextX(staffGroup.voices[i]) > x) {
			x = layoutVoiceElements.getNextX(staffGroup.voices[i]);
			spacingunit = layoutVoiceElements.getSpacingUnits(staffGroup.voices[i]);
		}
	}

	// adjust lastBar when needed (multi staves)
	checkLastBarX(staffGroup.voices);
	spacingunits += spacingunit;
	staffGroup.setWidth(x);

	return { spacingUnits: spacingunits, minSpace: minspace };
};


function finished(voices: any[]): boolean {
	for (let i = 0; i < voices.length; i++) {
		if (!layoutVoiceElements.layoutEnded(voices[i])) return false;
	}
	return true;
}

function getDurationIndex(element: any): number {
	return element.durationindex - (element.children[element.i] && (element.children[element.i].duration > 0) ? 0 : 0.0000005);
}

function isSameStaff(voice1: any, voice2: any): boolean {
	if (!voice1 || !voice1.staff || !voice1.staff.voices || voice1.staff.voices.length === 0)
		return false;
	if (!voice2 || !voice2.staff || !voice2.staff.voices || voice2.staff.voices.length === 0)
		return false;
	return (voice1.staff.voices[0] === voice2.staff.voices[0]);
}

export default layoutStaffGroup;
