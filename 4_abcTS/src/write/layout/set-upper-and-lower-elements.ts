import spacing from '../helpers/spacing';
const margin: number = 1;
const setUpperAndLowerElements = function (renderer: Renderer, staffGroup: StaffGroupElement): void {
    let lastStaffBottom;
    for (let i: number = 0; i < staffGroup.staffs.length; i++) {
        const staff: Staffs = staffGroup.staffs[i];
        const positionY = {
            tempoHeightAbove: 0,
            partHeightAbove: 0,
            volumeHeightAbove: 0,
            dynamicHeightAbove: 0,
            endingHeightAbove: 0,
            chordHeightAbove: 0,
            lyricHeightAbove: 0,
            lyricHeightBelow: 0,
            chordHeightBelow: 0,
            volumeHeightBelow: 0,
            dynamicHeightBelow: 0
        };
        if (renderer.showDebug && renderer.showDebug.indexOf("box") >= 0) {
            staff.originalTop = staff.top;
            staff.originalBottom = staff.bottom;
        }
        incTop(staff, positionY, 'lyricHeightAbove');
        incTop(staff, positionY, 'chordHeightAbove', staff.specialY.chordLines.above);
        if (staff.specialY.endingHeightAbove) {
            if (staff.specialY.chordHeightAbove)
                staff.top += 2;
            else
                staff.top += staff.specialY.endingHeightAbove + margin;
            positionY.endingHeightAbove = staff.top;
        }
        if (staff.specialY.dynamicHeightAbove && staff.specialY.volumeHeightAbove) {
            staff.top += Math.max(staff.specialY.dynamicHeightAbove, staff.specialY.volumeHeightAbove) + margin;
            positionY.dynamicHeightAbove = staff.top;
            positionY.volumeHeightAbove = staff.top;
        }
        else {
            incTop(staff, positionY, 'dynamicHeightAbove');
            incTop(staff, positionY, 'volumeHeightAbove');
        }
        incTop(staff, positionY, 'partHeightAbove');
        incTop(staff, positionY, 'tempoHeightAbove');
        if (staff.specialY.lyricHeightBelow) {
            staff.specialY.lyricHeightBelow += renderer.spacing.vocal / spacing.STEP;
            positionY.lyricHeightBelow = staff.bottom;
            staff.bottom -= (staff.specialY.lyricHeightBelow + margin);
        }
        if (staff.specialY.chordHeightBelow) {
            positionY.chordHeightBelow = staff.bottom;
            let hgt: number = staff.specialY.chordHeightBelow;
            if (staff.specialY.chordLines.below)
                hgt *= staff.specialY.chordLines.below;
            staff.bottom -= (hgt + margin);
        }
        if (staff.specialY.volumeHeightBelow && staff.specialY.dynamicHeightBelow) {
            positionY.volumeHeightBelow = staff.bottom;
            positionY.dynamicHeightBelow = staff.bottom;
            staff.bottom -= (Math.max(staff.specialY.volumeHeightBelow, staff.specialY.dynamicHeightBelow) + margin);
        }
        else if (staff.specialY.volumeHeightBelow) {
            positionY.volumeHeightBelow = staff.bottom;
            staff.bottom -= (staff.specialY.volumeHeightBelow + margin);
        }
        else if (staff.specialY.dynamicHeightBelow) {
            positionY.dynamicHeightBelow = staff.bottom;
            staff.bottom -= (staff.specialY.dynamicHeightBelow + margin);
        }
        if (renderer.showDebug && renderer.showDebug.indexOf("box") >= 0)
            staff.positionY = positionY;
        for (let j: number = 0; j < staff.voices.length; j++) {
            const voice: VoiceElement = staffGroup.voices[staff.voices[j]];
            setUpperAndLowerVoiceElements(positionY, voice, renderer.spacing);
        }
        if (lastStaffBottom !== undefined) {
            const thisStaffTop: number = staff.top - 10;
            const forcedSpacingBetween = lastStaffBottom + thisStaffTop;
            const minSpacingInPitches: number = renderer.spacing.systemStaffSeparation / spacing.STEP;
            const addedSpace: number = minSpacingInPitches - forcedSpacingBetween;
            if (addedSpace > 0)
                staff.top += addedSpace;
        }
        staff.top += renderer.spacing.staffTopMargin / spacing.STEP;
        lastStaffBottom = 2 - staff.bottom;
    }
};
function incTop(staff: Staffs, positionY: any, item: string, count: number): void {
    if (staff.specialY[item]) {
        let height: number = staff.specialY[item];
        if (count)
            height *= count;
        staff.top += height + margin;
        positionY[item] = staff.top;
    }
}
function setUpperAndLowerVoiceElements(positionY: any, voice: VoiceElement, spacingOption: Spacing): void {
    for (let i: number = 0; i < voice.children.length; i++) {
        setUpperAndLowerAbsoluteElements(positionY, voice.children[i], spacingOption);
    }
    for (let i: number = 0; i < voice.otherchildren.length; i++) {
        const abselem: string | TieElem | EndingElem | TripletElem = voice.otherchildren[i];
        switch (abselem.type) {
            case 'CrescendoElem':
                setUpperAndLowerCrescendoElements(positionY, abselem);
                break;
            case 'DynamicDecoration':
                setUpperAndLowerDynamicElements(positionY, abselem);
                break;
            case 'EndingElem':
                setUpperAndLowerEndingElements(positionY, abselem);
                break;
            case 'TieElem':
                const yBounds: Array<number> = abselem.getYBounds();
                voice.staff.top = Math.max(voice.staff.top, yBounds[0]);
                voice.staff.top = Math.max(voice.staff.top, yBounds[1]);
                voice.staff.bottom = Math.min(voice.staff.bottom, yBounds[0]);
                voice.staff.bottom = Math.min(voice.staff.bottom, yBounds[1]);
                break;
        }
    }
}
function setUpperAndLowerAbsoluteElements(specialYResolved: any, element: AbsoluteElement, spacingOption: Spacing): void {
    for (let i: number = 0; i < element.children.length; i++) {
        const child: RelativeElement | TempoElement = element.children[i];
        for (const key in element.specialY) {
            if (Object.prototype.hasOwnProperty.call(element.specialY, key)) {
                if (child[key]) {
                    child.pitch = specialYResolved[key];
                    if (child.top === undefined) {
                        if (child.type === 'TempoElement') {
                            setUpperAndLowerTempoElement(specialYResolved, child);
                        }
                        else {
                            setUpperAndLowerRelativeElements(specialYResolved, child, spacingOption);
                        }
                        element.pushTop(child.top);
                        element.pushBottom(child.bottom);
                    }
                }
            }
        }
    }
}
function setUpperAndLowerCrescendoElements(positionY, element: TieElem): void {
    if (element.dynamicHeightAbove)
        element.pitch = positionY.dynamicHeightAbove;
    else
        element.pitch = positionY.dynamicHeightBelow;
}
function setUpperAndLowerDynamicElements(positionY, element: TieElem): void {
    if (element.volumeHeightAbove)
        element.pitch = positionY.volumeHeightAbove;
    else
        element.pitch = positionY.volumeHeightBelow;
}
function setUpperAndLowerEndingElements(positionY: any, element: EndingElem): void {
    element.pitch = positionY.endingHeightAbove - 2;
}
function setUpperAndLowerTempoElement(positionY: any, element: TempoElement): void {
    element.pitch = positionY.tempoHeightAbove;
    element.top = positionY.tempoHeightAbove;
    element.bottom = positionY.tempoHeightAbove;
    if (element.note) {
        const tempoPitch: number = element.pitch - element.totalHeightInPitches + 1;
        element.note.top = tempoPitch;
        element.note.bottom = tempoPitch;
        for (let i: number = 0; i < element.note.children.length; i++) {
            const child: RelativeElement = element.note.children[i];
            child.top += tempoPitch;
            child.bottom += tempoPitch;
            child.pitch += tempoPitch;
            if (child.pitch2 !== undefined)
                child.pitch2 += tempoPitch;
        }
    }
}
function setUpperAndLowerRelativeElements(positionY: any, element: RelativeElement, renderSpacing: Spacing): void {
    switch (element.type) {
        case "part":
            element.top = positionY.partHeightAbove + element.height;
            element.bottom = positionY.partHeightAbove;
            break;
        case "text":
        case "chord":
            if (element.chordHeightAbove) {
                element.top = positionY.chordHeightAbove;
                element.bottom = positionY.chordHeightAbove;
            }
            else {
                element.top = positionY.chordHeightBelow;
                element.bottom = positionY.chordHeightBelow;
            }
            break;
        case "lyric":
            if (element.lyricHeightAbove) {
                element.top = positionY.lyricHeightAbove;
                element.bottom = positionY.lyricHeightAbove;
            }
            else {
                element.top = positionY.lyricHeightBelow + renderSpacing.vocal / spacing.STEP;
                element.bottom = positionY.lyricHeightBelow + renderSpacing.vocal / spacing.STEP;
                element.pitch -= renderSpacing.vocal / spacing.STEP;
            }
            break;
        case "debug":
            element.top = positionY.chordHeightAbove;
            element.bottom = positionY.chordHeightAbove;
            break;
    }
    if (element.pitch === undefined || element.top === undefined)
        console.error("RelativeElement position not set.", element.type, element.pitch, element.top, positionY);
}
export default setUpperAndLowerElements;
