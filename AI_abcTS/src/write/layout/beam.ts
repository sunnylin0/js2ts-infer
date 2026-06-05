import RelativeElement from '../creation/elements/relative-element';
import spacing from '../helpers/spacing';
import getBarYAt from './get-bar-y-at';

const layoutBeam = function (beam: any): void {
	if (beam.elems.length === 0 || beam.allrests) return;

	const dy = calcDy(beam.stemsUp, beam.isgrace); // Width of the beam line

	// create the main beam
	const firstElement = beam.elems[0];
	const lastElement = beam.elems[beam.elems.length - 1];
	let minStemHeight = 0;
	const referencePitch = beam.stemsUp ? firstElement.abcelem.maxpitch : firstElement.abcelem.minpitch;
	minStemHeight = minStem(firstElement, beam.stemsUp, referencePitch, minStemHeight);
	minStemHeight = minStem(lastElement, beam.stemsUp, referencePitch, minStemHeight);
	minStemHeight = Math.max(beam.stemHeight, minStemHeight + 3);

	const yPos = calcYPos(beam.average, beam.elems.length, minStemHeight, beam.stemsUp, firstElement.abcelem.averagepitch, lastElement.abcelem.averagepitch, beam.isflat, beam.min, beam.max, beam.isgrace);
	const xPos = calcXPos(beam.stemsUp, firstElement, lastElement);
	beam.addBeam({ startX: xPos[0], endX: xPos[1], startY: yPos[0], endY: yPos[1], dy: dy });

	// create the rest of the beams (for 16th notes, etc.)
	const beams = createAdditionalBeams(beam.elems, beam.stemsUp, beam.beams[0], beam.isgrace, dy);
	for (let i = 0; i < beams.length; i++)
		beam.addBeam(beams[i]);

	// Create stems and attach them to the original notes
	createStems(beam.elems, beam.stemsUp, beam.beams[0], dy, beam.mainNote);
};

function getDurlog(duration: number | undefined): number {
	if (duration === undefined) {
		return 0;
	}
	return Math.floor(Math.log(duration) / Math.log(2));
}

function minStem(element: any, stemsUp: boolean, referencePitch: number, minStemHeight: number): number {
	if (!element.children)
		return minStemHeight;
	for (let i = 0; i < element.children.length; i++) {
		const elem = element.children[i];
		if (stemsUp && elem.top !== undefined && elem.c === "flags.ugrace")
			minStemHeight = Math.max(minStemHeight, elem.top - referencePitch);
		else if (!stemsUp && elem.bottom !== undefined && elem.c === "flags.ugrace")
			minStemHeight = Math.max(minStemHeight, referencePitch - elem.bottom + 7);
	}
	return minStemHeight;
}

function calcSlant(leftAveragePitch: number, rightAveragePitch: number, numStems: number, isFlat: boolean): number {
	if (isFlat)
		return 0;
	let slant = leftAveragePitch - rightAveragePitch;
	const maxSlant = numStems / 2;

	if (slant > maxSlant) slant = maxSlant;
	if (slant < -maxSlant) slant = -maxSlant;
	return slant;
}

function calcDy(asc: boolean, isGrace: boolean): number {
	let dy = (asc) ? spacing.STEP : -spacing.STEP;
	if (isGrace) dy = dy * 0.4;
	return dy;
}

function calcXPos(asc: boolean, firstElement: any, lastElement: any): [number, number] {
	const starthead = firstElement.heads[asc ? 0 : firstElement.heads.length - 1];
	const endhead = lastElement.heads[asc ? 0 : lastElement.heads.length - 1];
	let startX = starthead.x;
	if (asc) startX += starthead.w - 0.6;
	let endX = endhead.x;
	endX += (asc) ? endhead.w : 0.6;
	return [startX, endX];
}

function calcYPos(average: number, numElements: number, stemHeight: number, asc: boolean, firstAveragePitch: number, lastAveragePitch: number, isFlat: boolean, minPitch: number, maxPitch: number, isGrace: boolean): [number, number] {
	const barpos = stemHeight - 2;
	const barminpos = stemHeight - 2;
	const pos = Math.round(asc ? Math.max(average + barpos, maxPitch + barminpos) : Math.min(average - barpos, minPitch - barminpos));

	const slant = calcSlant(firstAveragePitch, lastAveragePitch, numElements, isFlat);
	let startY = pos + Math.floor(slant / 2);
	let endY = pos + Math.floor(-slant / 2);

	if (!isGrace) {
		if (asc && pos < 6) {
			startY = 6;
			endY = 6;
		} else if (!asc && pos > 6) {
			startY = 6;
			endY = 6;
		}
	}

	return [startY, endY];
}

function createStems(elems: any[], asc: boolean, beam: any, dy: number, mainNote: any): void {
	for (let i = 0; i < elems.length; i++) {
		const elem = elems[i];
		if (elem.abcelem.rest)
			continue;

		const isGrace = elem.addExtra ? false : true;
		const parent = isGrace ? mainNote : elem;
		const furthestHead = elem.heads[(asc) ? 0 : elem.heads.length - 1];
		const ovalDelta = 1 / 5;
		let pitch = furthestHead.pitch + ((asc) ? ovalDelta : -ovalDelta);
		let dx = asc ? furthestHead.w : 0;
		if (!isGrace)
			dx += furthestHead.dx;

		const x = furthestHead.x + dx;
		let bary = getBarYAt(beam.startX, beam.startY, beam.endX, beam.endY, x);
		const lineWidth = (asc) ? -0.6 : 0.6;
		if (!asc)
			bary -= (dy / 2) / spacing.STEP;

		if (isGrace)
			dx += elem.heads[0].dx;

		if (furthestHead.c === 'noteheads.slash.quarter') {
			if (asc)
				pitch += 1;
			else
				pitch -= 1;
		}
		const stem = new RelativeElement(null, dx, 0, pitch, {
			"type": "stem",
			"pitch2": bary,
			linewidth: lineWidth
		});
		stem.setX(parent.x);
		parent.addRight(stem);
	}
}

function findNextNonRest(elems: any[], startIndex: number): number {
	for (let k = startIndex + 1; k < elems.length; k++) {
		if (!elems[k].abcelem.rest) {
			return k;
		}
	}
	return -1;
}

function findPrevNonRest(elems: any[], startIndex: number): number {
	for (let k = startIndex - 1; k >= 0; k--) {
		if (!elems[k].abcelem.rest) {
			return k;
		}
	}
	return -1;
}

function createAdditionalBeams(elems: any[], asc: boolean, beam: any, isGrace: boolean, dy: number): any[] {
	const beams: any[] = [];
	let auxBeams: any[] = [];
	for (let i = 0; i < elems.length; i++) {
		const elem = elems[i];
		if (elem.abcelem.rest)
			continue;
		const furthestHead = elem.heads[(asc) ? 0 : elem.heads.length - 1];
		const x = furthestHead.x + ((asc) ? furthestHead.w : 0);
		const bary = getBarYAt(beam.startX, beam.startY, beam.endX, beam.endY, x);

		let sy = (asc) ? -1.5 : 1.5;
		if (isGrace) sy = sy * 2 / 3;
		let duration = elem.abcelem.duration;
		if (duration === 0) duration = 0.25;

		for (let durlog = getDurlog(duration); durlog < -3; durlog++) {
			const index = -4 - durlog;
			if (auxBeams[index]) {
				auxBeams[index].single = false;
			} else {
				auxBeams[index] = {
					x: x + ((asc) ? -0.6 : 0),
					y: bary + sy * (index + 1),
					durlog: durlog,
					single: true
				};
			}
			if (i > 0 && elem.abcelem.beambr && elem.abcelem.beambr <= (index + 1)) {
				if (!auxBeams[index].split)
					auxBeams[index].split = [auxBeams[index].x];
				const xPos = calcXPos(asc, elems[i - 1], elem);
				if (auxBeams[index].split[auxBeams[index].split.length - 1] >= xPos[0]) {
					xPos[0] += elem.w;
				}
				auxBeams[index].split.push(xPos[0]);
				auxBeams[index].split.push(xPos[1]);
			}
		}

		for (let j = auxBeams.length - 1; j >= 0; j--) {
			const nextNonRestIndex = findNextNonRest(elems, i);
			const shouldEndBeam = (nextNonRestIndex === -1) ||
				(nextNonRestIndex < elems.length && getDurlog(elems[nextNonRestIndex].abcelem.duration) > (-j - 4));

			if (shouldEndBeam) {
				let auxBeamEndX = x;
				let auxBeamEndY = bary + sy * (j + 1);

				if (auxBeams[j].single) {
					const prevNonRestIndex = findPrevNonRest(elems, i);
					const isFirstNote = (prevNonRestIndex === -1);
					const isLastNote = (nextNonRestIndex === -1);

					if (isFirstNote) {
						auxBeamEndX = x + 5;
					} else if (isLastNote) {
						auxBeamEndX = x - 5;
					} else {
						const prevDuration = elems[prevNonRestIndex].abcelem.duration;
						const nextDuration = elems[nextNonRestIndex].abcelem.duration;
						if (prevDuration === nextDuration) {
							auxBeamEndX = i % 2 === 0 ? x + 5 : x - 5;
						} else {
							auxBeamEndX = prevDuration < nextDuration ? x + 5 : x - 5;
						}
					}
					auxBeamEndY = getBarYAt(beam.startX, beam.startY, beam.endX, beam.endY, auxBeamEndX) + sy * (j + 1);
				}
				const b: any = { startX: auxBeams[j].x, endX: auxBeamEndX, startY: auxBeams[j].y, endY: auxBeamEndY, dy: dy };
				if (auxBeams[j].split !== undefined) {
					const split = auxBeams[j].split;
					if (b.endX <= split[split.length - 1]) {
						split[split.length - 1] -= elem.w;
					}
					split.push(b.endX);
					b.split = auxBeams[j].split;
				}
				beams.push(b);
				auxBeams = auxBeams.slice(0, j);
			}
		}
	}
	return beams;
}

export default layoutBeam;
