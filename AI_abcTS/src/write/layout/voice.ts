import layoutBeam from './beam';
import getBarYAt from './get-bar-y-at';
import layoutTriplet from './triplet';

const layoutVoice = function (voice: any): void {
	for (let i = 0; i < voice.beams.length; i++) {
		if (voice.beams[i].type === 'BeamElem') {
			layoutBeam(voice.beams[i]);
			moveDecorations(voice.beams[i]);
			// Update the voice range after beam logic adjusts children positions
			for (let j = 0; j < voice.beams[i].elems.length; j++) {
				voice.adjustRange(voice.beams[i].elems[j]);
			}
		}
	}
	voice.staff.specialY.chordLines = setLaneForChord(voice.children);

	// Layout triplets after beam layout is finalized
	for (let i = 0; i < voice.otherchildren.length; i++) {
		const child = voice.otherchildren[i];
		if (child.type === 'TripletElem') {
			layoutTriplet(child);
			voice.adjustRange(child);
		}
	}
	voice.staff.top = Math.max(voice.staff.top, voice.top);
	voice.staff.bottom = Math.min(voice.staff.bottom, voice.bottom);
};

function moveDecorations(beam: any): void {
	const padding = 1.5; // Vertical padding in pitches
	for (let ch = 0; ch < beam.elems.length; ch++) {
		const child = beam.elems[ch];
		if (child.top) {
			let top = yAtNote(child, beam);
			for (let i = 0; i < child.children.length; i++) {
				const el = child.children[i];
				if (el.klass === 'ornament' && el.position !== 'below') {
					if (el.bottom - padding < top) {
						const distance = top - el.bottom + padding;
						el.bottom += distance;
						el.top += distance;
						el.pitch += distance;
						top = child.top = el.top;
					}
				}
			}
		}
	}
}

function placeInLane(rightMost: number[], relElem: any): void {
	const xCoords = relElem.getChordDim();
	if (xCoords) {
		for (let i = 0; i < rightMost.length; i++) {
			if (rightMost[i] < xCoords.left) {
				if (i > 0)
					relElem.putChordInLane(i);
				rightMost[i] = xCoords.right;
				return;
			}
		}
		rightMost.push(xCoords.right);
		relElem.putChordInLane(rightMost.length - 1);
	}
}

function setLaneForChord(absElems: any[]): { above: number, below: number } {
	const rightMostAbove = [0];
	const rightMostBelow = [0];
	for (let i = 0; i < absElems.length; i++) {
		for (let j = 0; j < absElems[i].children.length; j++) {
			const relElem = absElems[i].children[j];
			if (relElem.chordHeightAbove) {
				placeInLane(rightMostAbove, relElem);
			}
		}
		for (let j = absElems[i].children.length - 1; j >= 0; j--) {
			const relElem = absElems[i].children[j];
			if (relElem.chordHeightBelow) {
				placeInLane(rightMostBelow, relElem);
			}
		}
	}
	if (rightMostAbove.length > 1 || rightMostBelow.length > 1)
		setLane(absElems, rightMostAbove.length);
	return { above: rightMostAbove.length, below: rightMostBelow.length };
}

function setLane(absElems: any[], numLanesAbove: number): void {
	for (let i = 0; i < absElems.length; i++) {
		for (let j = 0; j < absElems[i].children.length; j++) {
			const relElem = absElems[i].children[j];
			if (relElem.chordHeightAbove) {
				relElem.invertLane(numLanesAbove);
			}
		}
	}
}

function yAtNote(element: any, beam: any): number {
	const b = beam.beams[0];
	return getBarYAt(b.startX, b.startY, b.endX, b.endY, element.x);
}

export default layoutVoice;
