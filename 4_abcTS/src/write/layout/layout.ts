import layoutVoice from './voice';
import setUpperAndLowerElements from './set-upper-and-lower-elements';
import layoutStaffGroup from './staff-group';
import getLeftEdgeOfStaff from './get-left-edge-of-staff';
import layoutInGrid from './layout-in-grid';
/**
 * Main layout function that coordinates the horizontal and vertical positioning of music elements.
 */
const layout = function (renderer: Renderer, abctune: any, width: number, space: number, expandToWidest: boolean, timeBasedLayout: any): number {
    let i;
    let abcLine;
    let maxWidth: number = width;
    // Phase 1: Adjust X-coordinates for all staves/lines
    for (i = 0; i < abctune.lines.length; i++) {
        abcLine = abctune.lines[i];
        if (abcLine.staff) {
            let thisWidth;
            if (timeBasedLayout !== undefined)
                thisWidth = layoutInGrid(renderer, abcLine.staffGroup, timeBasedLayout);
            else
                thisWidth = setXSpacing(renderer, maxWidth, space, abcLine.staffGroup, abctune.formatting, i === abctune.lines.length - 1, false);
            if (Math.round(thisWidth) > Math.round(maxWidth)) {
                maxWidth = thisWidth;
                if (expandToWidest)
                    i = -1; // Recalculate everything if width increased
            }
        }
    }
    // Phase 2: Refine layout (Beams, Stems, and Vertical limits)
    for (i = 0; i < abctune.lines.length; i++) {
        abcLine = abctune.lines[i];
        if (abcLine.staffGroup && abcLine.staffGroup.voices) {
            for (let j: number = 0; j < abcLine.staffGroup.voices.length; j++)
                layoutVoice(abcLine.staffGroup.voices[j]);
            setUpperAndLowerElements(renderer, abcLine.staffGroup);
        }
    }
    // Phase 3: Synchronize vertical heights
    for (i = 0; i < abctune.lines.length; i++) {
        abcLine = abctune.lines[i];
        if (abcLine.staffGroup) {
            abcLine.staffGroup.setHeight();
        }
    }
    return maxWidth;
};
/**
 * Calculates horizontal spacing for a group of staves (a single system line).
 */
const setXSpacing = function (renderer: Renderer, width: number, space: number, staffGroup: StaffGroupElement, formatting: any, isLastLine: boolean, debug: boolean): number {
    const leftEdge: number = getLeftEdgeOfStaff(renderer, staffGroup.getTextSize, staffGroup.voices, staffGroup.brace, staffGroup.bracket);
    let newspace: number = space;
    for (let it: number = 0; it < 8; it++) {
        const ret = layoutStaffGroup(newspace, renderer.minPadding, debug, staffGroup, leftEdge);
        const calculatedSpace: number = calcHorizontalSpacing(isLastLine, formatting.stretchlast, width + renderer.padding.left, staffGroup.w, newspace, ret.spacingUnits, ret.minSpace, renderer.padding.left + renderer.padding.right);
        if (calculatedSpace === null)
            break;
        newspace = calculatedSpace;
    }
    centerWholeRests(staffGroup.voices);
    return staffGroup.w - leftEdge;
};
function calcHorizontalSpacing(isLastLine: boolean, stretchLast: any, targetWidth: number, lineWidth: number, spacing: number, spacingUnits: number, minSpace: number, padding: number): number {
    if (isLastLine) {
        if (stretchLast === undefined) {
            if (lineWidth / targetWidth < 0.66)
                return null;
        }
        else {
            const lack: number = 1 - (lineWidth + padding) / targetWidth;
            const stretch: boolean = lack < stretchLast;
            if (!stretch)
                return null;
        }
    }
    if (Math.abs(targetWidth - lineWidth) < 2)
        return null;
    if (spacingUnits > 0) {
        const relSpace: number = spacingUnits * spacing;
        const constSpace: number = lineWidth - relSpace;
        let newSpacing: number = (targetWidth - constSpace) / spacingUnits;
        if (newSpacing * minSpace > 50) {
            newSpacing = 50 / minSpace;
        }
        return newSpacing;
    }
    return null;
}
function centerWholeRests(voices: Array<VoiceElement>): void {
    for (let i: number = 0; i < voices.length; i++) {
        const voice: VoiceElement = voices[i];
        for (let j: number = 1; j < voice.children.length - 1; j++) {
            const absElem: AbsoluteElement = voice.children[j];
            if (absElem.abcelem.rest && (absElem.abcelem.rest.type === 'whole' || absElem.abcelem.rest.type === 'multimeasure')) {
                const before: AbsoluteElement = voice.children[j - 1];
                const after: AbsoluteElement = voice.children[j + 1];
                absElem.center(before, after);
            }
        }
    }
}
export default layout;
