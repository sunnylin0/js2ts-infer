import drawStaffGroup from './staff-group';
import setPaperSize from './set-paper-size';
import nonMusic from './non-music';
import spacing from '../helpers/spacing';
import Selectables from './selectables';
import drawChordGrid from './chord-grid';
function draw(renderer: Renderer, classes: Classes, abcTune: Tune, width: number, maxWidth: number, responsive: any, scale: number, selectTypes: any, tuneNumber: number, lineOffset: number, chordGrid: any) {
    const selectables: Selectables = new Selectables(renderer.paper, selectTypes, tuneNumber);
    const groupClasses: {} = {};
    if (classes.shouldAddClasses)
        groupClasses.klass = "abcjs-meta-top";
    renderer.paper.openGroup(groupClasses);
    renderer.moveY(renderer.padding.top);
    nonMusic(renderer, abcTune.topText, selectables);
    renderer.paper.closeGroup();
    renderer.moveY(renderer.spacing.music);
    let suppressMusic: boolean = false;
    if (chordGrid && abcTune.chordGrid) {
        drawChordGrid(renderer, abcTune.chordGrid, renderer.padding.left, width, abcTune.formatting);
        if (chordGrid === 'noMusic')
            suppressMusic = true;
    }
    const staffgroups: Array<any> = [];
    let nStaves: number = 0;
    if (!suppressMusic) {
        for (let line: number = 0; line < abcTune.lines.length; line++) {
            classes.incrLine();
            const abcLine: Lines = abcTune.lines[line];
            if (abcLine.staff) {
                // MAE 26 May 2025 - for incipits staff count limiting
                nStaves++;
                if (abcTune.formatting.maxStaves) {
                    if (nStaves > abcTune.formatting.maxStaves) {
                        break;
                    }
                }
                if (classes.shouldAddClasses)
                    groupClasses.klass = "abcjs-staff-wrapper abcjs-l" + classes.lineNumber;
                renderer.paper.openGroup(groupClasses);
                if (abcLine.vskip) {
                    renderer.moveY(abcLine.vskip);
                }
                if (staffgroups.length >= 1)
                    addStaffPadding(renderer, renderer.spacing.staffSeparation, staffgroups[staffgroups.length - 1], abcLine.staffGroup);
                const staffgroup: StaffGroupElement = engraveStaffLine(renderer, abcLine.staffGroup, selectables, line);
                staffgroup.line = lineOffset + line; // If there are non-music lines then the staffgroup array won't line up with the line array, so this keeps track.
                staffgroups.push(staffgroup);
                renderer.paper.closeGroup();
            }
            else if (abcLine.nonMusic) {
                if (classes.shouldAddClasses)
                    groupClasses.klass = "abcjs-non-music";
                renderer.paper.openGroup(groupClasses);
                nonMusic(renderer, abcLine.nonMusic, selectables);
                renderer.paper.closeGroup();
            }
        }
    }
    classes.reset();
    if (!suppressMusic) {
        if (abcTune.bottomText && abcTune.bottomText.rows && abcTune.bottomText.rows.length > 0) {
            if (classes.shouldAddClasses)
                groupClasses.klass = "abcjs-meta-bottom";
            renderer.paper.openGroup(groupClasses);
            renderer.moveY(24); // TODO-PER: Empirically discovered. What variable should this be?
            nonMusic(renderer, abcTune.bottomText, selectables);
            renderer.paper.closeGroup();
        }
    }
    setPaperSize(renderer, maxWidth, scale, responsive);
    return { staffgroups: staffgroups, selectables: selectables.getElements() };
}
function engraveStaffLine(renderer: Renderer, staffGroup: StaffGroupElement, selectables: Selectables, lineNumber: number): StaffGroupElement {
    drawStaffGroup(renderer, staffGroup, selectables, lineNumber);
    const height: number = staffGroup.height * spacing.STEP;
    renderer.y += height;
    return staffGroup;
}
function addStaffPadding(renderer: Renderer, staffSeparation: number, lastStaffGroup: StaffGroupElement, thisStaffGroup: StaffGroupElement): void {
    const lastStaff: Staffs = lastStaffGroup.staffs[lastStaffGroup.staffs.length - 1];
    const lastBottomLine: number = -(lastStaff.bottom - 2); // The 2 is because the scale goes to 2 below the last line.
    const nextTopLine: number = thisStaffGroup.staffs[0].top - 10; // Because 10 represents the top line.
    const naturalSeparation: number = nextTopLine + lastBottomLine; // This is how far apart they'd be without extra spacing
    const separationInPixels: number = naturalSeparation * spacing.STEP;
    if (separationInPixels < staffSeparation)
        renderer.moveY(staffSeparation - separationInPixels);
}
export default draw;
