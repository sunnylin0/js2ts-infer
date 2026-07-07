import VoiceElement from '../../write/creation/elements/voice-element';
import TabAbsoluteElements from './tab-absolute-elements';
import spacing from '../../write/helpers/spacing';
function initSpecialY() {
    return {
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
}
function getLyricHeight(voice): number {
    let maxLyricHeight: number = 0;
    if (voice.children) {
        for (let ii: number = 0; ii < voice.children.length; ii++) {
            const curAbs = voice.children[ii];
            if (curAbs.specialY && curAbs.specialY.lyricHeightBelow > maxLyricHeight) {
                maxLyricHeight = curAbs.specialY.lyricHeightBelow;
            }
        }
    }
    return maxLyricHeight;
}
function buildTabName(plugin: PluginInstance, renderer, dest: VoiceElement): number {
    const stringSemantics = plugin.semantics;
    const textSize = renderer.controller.getTextSize;
    const tabName = stringSemantics.tabInfos(plugin);
    const suppress = stringSemantics.suppress(plugin);
    if (!suppress) {
        const size = textSize.calc(tabName, 'tablabelfont', 'text instrumentname');
        dest.tabNameInfos = {
            textSize: { height: size.height, width: size.width },
            name: tabName
        };
        return size.height;
    }
    return 0;
}
function islastTabInStaff(index: number, staffGroup): boolean {
    if (staffGroup[index].isTabStaff) {
        if (index === staffGroup.length - 1)
            return true;
        return !staffGroup[index + 1].isTabStaff;
    }
    return false;
}
function getStaffNumbers(staffs): number {
    let nbStaffs: number = 0;
    for (let ii: number = 0; ii < staffs.length; ii++) {
        if (!staffs[ii].isTabStaff) {
            nbStaffs++;
        }
    }
    return nbStaffs;
}
function getParentStaffIndex(staffs, index: number): number {
    for (let ii: number = index; ii >= 0; ii--) {
        if (!staffs[ii].isTabStaff) {
            return ii;
        }
    }
    return -1;
}
function linkStaffAndTabs(staffs): void {
    for (let ii: number = 0; ii < staffs.length; ii++) {
        if (staffs[ii].isTabStaff) {
            const parentIndex: number = getParentStaffIndex(staffs, ii);
            if (parentIndex !== -1) {
                staffs[ii].hasStaff = staffs[parentIndex];
                if (!staffs[parentIndex].hasTab)
                    staffs[parentIndex].hasTab = [];
                staffs[parentIndex].hasTab.push(staffs[ii]);
            }
        }
    }
}
function isMultiVoiceSingleStaff(staffs, parent): boolean {
    if (getStaffNumbers(staffs) === 1) {
        if (parent.voices && parent.voices.length > 1)
            return true;
    }
    return false;
}
function getNextTabPos(tabIndex, staffGroup): number {
    let startIndex: number = 0;
    let handledVoices: number = 0;
    let nbVoices: number = 0;
    while (true) {
        if (!staffGroup[startIndex])
            return -1;
        if (!staffGroup[startIndex].isTabStaff) {
            nbVoices = staffGroup[startIndex].voices ? staffGroup[startIndex].voices.length : 0;
        }
        if (staffGroup[startIndex].isTabStaff) {
            handledVoices++;
            if (islastTabInStaff(startIndex, staffGroup)) {
                if (handledVoices < nbVoices)
                    return startIndex + 1;
            }
        }
        else {
            handledVoices = 0;
            if (startIndex >= tabIndex) {
                if (startIndex + 1 === staffGroup.length)
                    return startIndex + 1;
                if (!staffGroup[startIndex + 1].isTabStaff)
                    return startIndex + 1;
            }
        }
        startIndex++;
        if (startIndex > staffGroup.length)
            return -1;
    }
}
function getLastStaff(staffs, lastTab: number) {
    for (let ii: number = lastTab; ii >= 0; ii--) {
        if (!staffs[ii].isTabStaff) {
            return staffs[ii];
        }
    }
    return null;
}
function checkVoiceKeySig(voices, ii): string {
    const curVoice = voices[ii];
    if (!curVoice || !curVoice.children || curVoice.children.length === 0)
        return null;
    const elem0 = curVoice.children[0].abcelem;
    if (elem0 && elem0.el_type === 'clef')
        return null;
    if (ii === 0)
        return 'none';
    return voices[ii - 1].children[0];
}
export default function tabRenderer(plugin: PluginInstance, renderer, line, staffIndex): void {
    const absolutes: TabAbsoluteElements = new TabAbsoluteElements();
    const tabStaff = { clef: { type: 'TAB' } };
    const tabSize: number = plugin.linePitch * plugin.nbLines;
    const staffs = line.staff;
    if (staffs) {
        const firstStaff = staffs[0];
        if (firstStaff && firstStaff.clef && firstStaff.clef.stafflines === 0) {
            plugin.setError("No tablatures when stafflines=0");
            return;
        }
        staffs.splice(staffs.length, 0, tabStaff);
    }
    const staffGroup = line.staffGroup;
    const voices = staffGroup.voices;
    const firstVoice = voices[0];
    const lyricsHeight: number = getLyricHeight(firstVoice);
    const padd: number = 3;
    const previousStaff = staffGroup.staffs[staffIndex];
    let tabTop: number = tabSize + padd - previousStaff.bottom - lyricsHeight;
    if (previousStaff.isTabStaff) {
        tabTop = previousStaff.top;
    }
    const staffGroupInfos = {
        bottom: -1,
        isTabStaff: true,
        specialY: initSpecialY(),
        lines: plugin.nbLines,
        linePitch: plugin.linePitch,
        dy: 0.15,
        top: tabTop,
    };
    const nextTabPos: number = getNextTabPos(staffIndex, staffGroup.staffs);
    if (nextTabPos === -1)
        return;
    staffGroupInfos.parentIndex = nextTabPos - 1;
    staffGroup.staffs.splice(nextTabPos, 0, staffGroupInfos);
    staffGroup.height += tabSize + padd;
    const parentStaff = getLastStaff(staffGroup.staffs, nextTabPos);
    let nbVoices: number = 1;
    if (isMultiVoiceSingleStaff(staffGroup.staffs, parentStaff)) {
        nbVoices = parentStaff.voices.length;
    }
    tabStaff.voices = [];
    for (let ii: number = 0; ii < nbVoices; ii++) {
        const tabVoice: VoiceElement = new VoiceElement(0, 0);
        if (ii > 0)
            tabVoice.duplicate = true;
        const nameHeight: number = buildTabName(plugin, renderer, tabVoice) / spacing.STEP;
        const finalNameHeight: number = Math.max(nameHeight, 1);
        staffGroup.staffs[staffIndex].top += 1;
        staffGroup.height += finalNameHeight;
        tabVoice.staff = staffGroupInfos;
        const tabVoiceIndex = voices.length;
        voices.splice(voices.length, 0, tabVoice);
        const keySig = checkVoiceKeySig(voices, ii + staffIndex);
        tabStaff.voices[ii] = [];
        absolutes.build(plugin, voices, tabStaff.voices[ii], ii, staffIndex, keySig, tabVoiceIndex);
    }
    linkStaffAndTabs(staffGroup.staffs);
}
