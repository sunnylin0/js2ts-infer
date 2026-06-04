import AbsoluteElement from '../../write/creation/elements/absolute-element';
import RelativeElement from '../../write/creation/elements/relative-element';
function isObject(a) {
    return a != null && a.constructor === Object;
}
function cloneObject(dest, src) {
    for (const prop in src) {
        if (Object.prototype.hasOwnProperty.call(src, prop)) {
            if (!(Array.isArray(src[prop]) || isObject(src[prop]))) {
                dest[prop] = src[prop];
            }
        }
    }
}
function cloneAbsolute(absSrc) {
    const returned = new AbsoluteElement('', 0, 0, '', 0);
    cloneObject(returned, absSrc);
    returned.top = 0;
    returned.bottom = -1;
    if (absSrc.abcelem) {
        returned.abcelem = {};
        cloneObject(returned.abcelem, absSrc.abcelem);
        if (returned.abcelem.el_type === "note")
            returned.abcelem.el_type = 'tabNumber';
    }
    absSrc.cloned = returned;
    return returned;
}
function cloneAbsoluteAndRelatives(absSrc, plugin) {
    const returned = cloneAbsolute(absSrc);
    if (plugin) {
        const children = absSrc.children;
        let first = true;
        for (let ii = 0; ii < children.length; ii++) {
            const child = children[ii];
            const relative = new RelativeElement('', 0, 0, 0, '');
            cloneObject(relative, child);
            if (plugin.tablature && plugin.tablature.setRelative) {
                first = plugin.tablature.setRelative(child, relative, first);
            }
            returned.children.push(relative);
        }
    }
    return returned;
}
function buildTabAbsolute(plugin, absX, relX) {
    let tabIcon = 'tab.tiny';
    let tabYPos = 7.5;
    if (plugin.isTabBig) {
        tabIcon = 'tab.big';
        tabYPos = 10;
    }
    const element = {
        el_type: "tab",
        icon: tabIcon,
        Ypos: tabYPos
    };
    const tabYOffset = plugin.tabSymbolOffset || 0;
    const finalYPos = tabYPos + tabYOffset;
    const tabAbsolute = new AbsoluteElement(element, 0, 0, "symbol", 0);
    if (!plugin.hideTabSymbol) {
        tabAbsolute.x = absX;
        const tabRelative = new RelativeElement(tabIcon, 0, 0, 7.5, "tab");
        tabRelative.x = relX;
        tabAbsolute.children.push(tabRelative);
        if (tabAbsolute.abcelem.el_type === 'tab') {
            tabRelative.pitch = finalYPos;
        }
    }
    return tabAbsolute;
}
function lyricsDim(abs) {
    if (abs.extra) {
        for (let ii = 0; ii < abs.extra.length; ii++) {
            const extra = abs.extra[ii];
            if (extra.type === 'lyric') {
                return {
                    bottom: extra.bottom,
                    height: extra.height
                };
            }
        }
    }
    return null;
}
function buildRelativeTabNote(plugin, relX, def, curNote, isGrace) {
    let strNote = curNote.num;
    if (curNote.note && curNote.note.quarter != null) {
        strNote = strNote.toString() + curNote.note.quarter;
    }
    const pitch = plugin.semantics.stringToPitch(curNote.str);
    def.notes.push({ num: strNote, str: curNote.str, pitch: curNote.note ? curNote.note.emit() : '' });
    const opt = { type: 'tabNumber' };
    const tabNoteRelative = new RelativeElement(strNote, 0, 0, pitch + 0.3, opt);
    tabNoteRelative.x = relX;
    tabNoteRelative.isGrace = isGrace;
    tabNoteRelative.isAltered = curNote.note ? curNote.note.isAltered : false;
    return tabNoteRelative;
}
function getXGrace(abs, index) {
    let found = 0;
    if (abs.extra) {
        for (let ii = 0; ii < abs.extra.length; ii++) {
            if (abs.extra[ii].c && abs.extra[ii].c.indexOf('noteheads') >= 0) {
                if (found === index) {
                    return abs.extra[ii].x + abs.extra[ii].w / 2;
                }
                else {
                    found++;
                }
            }
        }
    }
    return -1;
}
function graceInRest(absElem) {
    if (absElem.abcelem) {
        const elem = absElem.abcelem;
        if (elem.rest) {
            return elem.gracenotes;
        }
    }
    return null;
}
function convertToNumber(plugin, pitches, graceNotes) {
    const tabPos = plugin.semantics.notesToNumber(pitches, graceNotes);
    if (tabPos.error) {
        plugin.setError(tabPos.error);
        return tabPos;
    }
    if (tabPos.graces && tabPos.notes) {
        const posNote = tabPos.notes.length - 1;
        if (posNote >= 0) {
            tabPos.notes[posNote].graces = tabPos.graces;
        }
    }
    return tabPos;
}
function buildGraceRelativesForRest(plugin, abs, absChild, graceNotes, tabVoice) {
    for (let mm = 0; mm < graceNotes.length; mm++) {
        const defGrace = { el_type: "note", startChar: absChild.abcelem.startChar, endChar: absChild.abcelem.endChar, notes: [], grace: true };
        const graceX = getXGrace(absChild, mm);
        const curGrace = graceNotes[mm];
        const tabGraceRelative = buildRelativeTabNote(plugin, graceX, defGrace, curGrace, true);
        abs.children.push(tabGraceRelative);
        tabVoice.push(defGrace);
    }
}
export default class TabAbsoluteElements {
    constructor() {
        this.accidentals = null;
    }
    build(plugin, staffAbsolute, tabVoice, voiceIndex, staffIndex, keySig, tabVoiceIndex) {
        const source = staffAbsolute[staffIndex + voiceIndex];
        const dest = staffAbsolute[tabVoiceIndex];
        let tabPos = null;
        let defNote = null;
        if (source.children.length > 0 && source.children[0].abcelem && source.children[0].abcelem.el_type !== 'clef') {
            if (keySig !== 'none') {
                source.children.splice(0, 0, keySig);
            }
        }
        for (let ii = 0; ii < source.children.length; ii++) {
            const absChild = source.children[ii];
            const absX = absChild.x;
            const relX = absX;
            if (absChild.isClef) {
                dest.children.push(buildTabAbsolute(plugin, absX, relX));
                if (absChild.abcelem && absChild.abcelem.type) {
                    if (absChild.abcelem.type.indexOf('-8') >= 0)
                        plugin.semantics.clefTranspose = -12;
                    if (absChild.abcelem.type.indexOf('+8') >= 0)
                        plugin.semantics.clefTranspose = 12;
                }
            }
            switch (absChild.type) {
                case 'staff-extra key-signature':
                    this.accidentals = absChild.abcelem.accidentals;
                    plugin.semantics.accidentals = this.accidentals;
                    break;
                case 'bar': {
                    plugin.semantics.measureAccidentals = {};
                    let lastBar = (ii === source.children.length - 1);
                    const cloned = cloneAbsoluteAndRelatives(absChild, plugin);
                    if (cloned.abcelem && cloned.abcelem.barNumber) {
                        delete cloned.abcelem.barNumber;
                        for (let bn = 0; bn < cloned.children.length; bn++) {
                            if (cloned.children[bn].type === "barNumber") {
                                cloned.children.splice(bn, 1);
                                break;
                            }
                        }
                    }
                    if (cloned.abcelem)
                        cloned.abcelem.lastBar = lastBar;
                    dest.children.push(cloned);
                    tabVoice.push({
                        el_type: absChild.abcelem.el_type,
                        type: absChild.abcelem.type,
                        endChar: absChild.abcelem.endChar,
                        startChar: absChild.abcelem.startChar,
                        abselem: cloned
                    });
                    break;
                }
                case 'rest': {
                    const restGraces = graceInRest(absChild);
                    if (restGraces) {
                        tabPos = convertToNumber(plugin, null, restGraces);
                        if (tabPos.error)
                            return;
                        // Note: Original code had a bug where 'abs' was undefined here.
                        // I'll attach grace relatives to 'dest' for now as a best effort.
                        buildGraceRelativesForRest(plugin, dest, absChild, tabPos.graces || [], tabVoice);
                    }
                    break;
                }
                case 'note': {
                    const abs = cloneAbsolute(absChild);
                    if (absChild.heads && absChild.heads.length > 0) {
                        abs.x = absChild.heads[0].x + absChild.heads[0].w / 2;
                    }
                    abs.lyricDim = lyricsDim(absChild);
                    const pitches = absChild.abcelem.pitches;
                    const graceNotes = absChild.abcelem.gracenotes;
                    abs.type = 'tabNumber';
                    tabPos = convertToNumber(plugin, pitches, graceNotes);
                    if (tabPos.error)
                        return;
                    defNote = { el_type: "note", startChar: absChild.abcelem.startChar, endChar: absChild.abcelem.endChar, notes: [] };
                    for (let ll = 0; ll < tabPos.notes.length; ll++) {
                        const curNote = tabPos.notes[ll];
                        if (curNote.graces) {
                            for (let mm = 0; mm < curNote.graces.length; mm++) {
                                const defGraceNote = { el_type: "note", startChar: absChild.abcelem.startChar, endChar: absChild.abcelem.endChar, notes: [], grace: true };
                                const graceX = getXGrace(absChild, mm);
                                const curGrace = curNote.graces[mm];
                                const tabGraceRelative = buildRelativeTabNote(plugin, graceX, defGraceNote, curGrace, true);
                                abs.children.push(tabGraceRelative);
                                tabVoice.push(defGraceNote);
                            }
                        }
                        const headXOffset = (absChild.heads && absChild.heads[ll]) ? absChild.heads[ll].dx : 0;
                        const tabNoteRelative = buildRelativeTabNote(plugin, abs.x + headXOffset, defNote, curNote, false);
                        abs.children.push(tabNoteRelative);
                    }
                    if (defNote.notes.length > 0) {
                        defNote.abselem = abs;
                        tabVoice.push(defNote);
                        dest.children.push(abs);
                    }
                    break;
                }
            }
        }
    }
}
