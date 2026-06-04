import parseKeyVoice from '../parse/abc_parse_key_voice';
export default class TuneBuilder {
    constructor(tune) {
        this.voiceDefs = {};
        this.currentVoiceName = '';
        this.tune = tune;
        this.tune.reset();
    }
    setVisualTranspose(visualTranspose) {
        if (visualTranspose !== undefined)
            this.tune.visualTranspose = visualTranspose;
    }
    cleanUp(barsperstaff, staffnonote, currSlur) {
        closeLine(this.tune);
        delete this.tune.runningFonts;
        simplifyMetaText(this.tune);
        if (this.tune.metaText.tempo && this.tune.metaText.tempo.bpm && !this.tune.metaText.tempo.duration)
            this.tune.metaText.tempo.duration = [this.tune.getBeatLength()];
        let anyDeleted = false;
        let i, s, v;
        for (i = 0; i < this.tune.lines.length; i++) {
            if (this.tune.lines[i].staff !== undefined) {
                let hasAny = false;
                for (s = 0; s < this.tune.lines[i].staff.length; s++) {
                    if (this.tune.lines[i].staff[s] === undefined) {
                        anyDeleted = true;
                        this.tune.lines[i].staff[s] = null;
                    }
                    else {
                        for (v = 0; v < this.tune.lines[i].staff[s].voices.length; v++) {
                            if (this.tune.lines[i].staff[s].voices[v] === undefined)
                                this.tune.lines[i].staff[s].voices[v] = [];
                            else if (containsNotes(this.tune.lines[i].staff[s].voices[v]))
                                hasAny = true;
                        }
                    }
                }
                if (!hasAny) {
                    this.tune.lines[i] = null;
                    anyDeleted = true;
                }
            }
        }
        if (anyDeleted) {
            this.tune.lines = this.tune.lines.filter(function (line) { return !!line; });
            this.tune.lines.forEach(function (line) {
                if (line.staff)
                    line.staff = line.staff.filter(function (l) { return !!l; });
            });
        }
        if (barsperstaff) {
            while (wrapMusicLines(this.tune.lines, barsperstaff)) {
            }
        }
        if (staffnonote) {
            anyDeleted = false;
            for (i = 0; i < this.tune.lines.length; i++) {
                if (this.tune.lines[i].staff !== undefined) {
                    for (s = 0; s < this.tune.lines[i].staff.length; s++) {
                        let keepThis = false;
                        for (v = 0; v < this.tune.lines[i].staff[s].voices.length; v++) {
                            if (containsNotesStrict(this.tune.lines[i].staff[s].voices[v])) {
                                keepThis = true;
                            }
                        }
                        if (!keepThis) {
                            anyDeleted = true;
                            this.tune.lines[i].staff[s] = null;
                        }
                    }
                }
            }
            if (anyDeleted) {
                this.tune.lines.forEach(function (line) {
                    if (line.staff)
                        line.staff = line.staff.filter(function (staff) { return !!staff; });
                });
            }
        }
        fixTitles(this.tune.lines);
        for (i = 0; i < this.tune.lines.length; i++) {
            if (this.tune.lines[i].staff) {
                for (s = 0; s < this.tune.lines[i].staff.length; s++)
                    delete this.tune.lines[i].staff[s].workingClef;
            }
        }
        let hadOverlays = false;
        while (resolveOverlays(this.tune)) {
            hadOverlays = true;
        }
        if (hadOverlays) {
            let voiceNum = 0;
            let isUseful = voiceUseful(this.tune.lines, voiceNum);
            while (isUseful !== 'not-found') {
                isUseful = voiceUseful(this.tune.lines, voiceNum);
                if (!isUseful)
                    deleteVoice(this.tune.lines, voiceNum);
                else
                    voiceNum++;
            }
        }
        for (let i = 0; i < this.tune.lines.length; i++) {
            const staff = this.tune.lines[i].staff;
            if (staff) {
                for (this.tune.staffNum = 0; this.tune.staffNum < staff.length; this.tune.staffNum++) {
                    if (staff[this.tune.staffNum].clef)
                        parseKeyVoice.fixClef(staff[this.tune.staffNum].clef);
                    for (this.tune.voiceNum = 0; this.tune.voiceNum < staff[this.tune.staffNum].voices.length; this.tune.voiceNum++) {
                        const voice = staff[this.tune.staffNum].voices[this.tune.voiceNum];
                        cleanUpSlursInLine(voice, this.tune.staffNum, this.tune.voiceNum, currSlur);
                        for (let j = 0; j < voice.length; j++) {
                            if (voice[j].el_type === 'clef')
                                parseKeyVoice.fixClef(voice[j]);
                        }
                        if (voice.length > 0 && voice[voice.length - 1].barNumber) {
                            const nextLine = getNextMusicLine(this.tune.lines, i);
                            if (nextLine)
                                nextLine.staff[0].barNumber = voice[voice.length - 1].barNumber;
                            delete voice[voice.length - 1].barNumber;
                        }
                    }
                }
            }
        }
        delete this.tune.staffNum;
        delete this.tune.voiceNum;
        delete this.tune.lineNum;
        delete this.tune.potentialStartBeam;
        delete this.tune.potentialEndBeam;
        delete this.tune.vskipPending;
        return currSlur;
    }
    addTieToLastNote(dottedTie) {
        const el = getLastNote(this.tune);
        if (el && el.pitches && el.pitches.length > 0) {
            el.pitches[0].startTie = {};
            if (dottedTie)
                el.pitches[0].startTie.style = 'dotted';
            return true;
        }
        return false;
    }
    appendElement(type, startChar, endChar, hashParams) {
        hashParams.el_type = type;
        if (startChar !== null)
            hashParams.startChar = startChar;
        if (endChar !== null)
            hashParams.endChar = endChar;
        if (type === 'note') {
            const dur = getDuration(hashParams);
            if (dur >= 0.25) {
                endBeamLast(this.tune);
            }
            else if (hashParams.force_end_beam_last && this.tune.potentialStartBeam !== undefined) {
                endBeamLast(this.tune);
            }
            else if (hashParams.end_beam && this.tune.potentialStartBeam !== undefined) {
                if (hashParams.rest === undefined)
                    endBeamHere(hashParams, this.tune);
                else
                    endBeamLast(this.tune);
            }
            else if (hashParams.rest === undefined) {
                if (this.tune.potentialStartBeam === undefined) {
                    if (!hashParams.end_beam) {
                        this.tune.potentialStartBeam = hashParams;
                        delete this.tune.potentialEndBeam;
                    }
                }
                else {
                    this.tune.potentialEndBeam = hashParams;
                }
            }
        }
        else {
            endBeamLast(this.tune);
        }
        delete hashParams.end_beam;
        delete hashParams.force_end_beam_last;
        if (hashParams.rest && hashParams.rest.type === 'invisible') {
            delete hashParams.decoration;
        }
        if (this.tune.lines.length <= this.tune.lineNum || this.tune.lines[this.tune.lineNum].staff.length <= this.tune.staffNum) {
            return false;
        }
        pushNote(this.tune, hashParams, this.voiceDefs, this.currentVoiceName);
        return true;
    }
    appendStartingElement(type, startChar, endChar, hashParams2) {
        closeLine(this.tune);
        let impliedNaturals;
        if (type === 'key') {
            impliedNaturals = hashParams2.impliedNaturals;
            delete hashParams2.impliedNaturals;
            delete hashParams2.explicitAccidentals;
        }
        const hashParams = Object.assign({}, hashParams2);
        if (!this.tune.lines[this.tune.lineNum])
            return;
        const staff = this.tune.lines[this.tune.lineNum].staff;
        if (!staff)
            return;
        if (staff.length <= this.tune.staffNum) {
            staff[this.tune.staffNum] = {};
            staff[this.tune.staffNum].clef = Object.assign({}, staff[0].clef);
            staff[this.tune.staffNum].key = Object.assign({}, staff[0].key);
            if (staff[0].meter)
                staff[this.tune.staffNum].meter = Object.assign({}, staff[0].meter);
            staff[this.tune.staffNum].workingClef = Object.assign({}, staff[0].workingClef);
            staff[this.tune.staffNum].voices = [[]];
        }
        if (type === 'clef') {
            staff[this.tune.staffNum].workingClef = hashParams;
        }
        const voice = staff[this.tune.staffNum].voices[this.tune.voiceNum];
        if (voice) {
            for (let i = 0; i < voice.length; i++) {
                if (voice[i].el_type === 'note' || voice[i].el_type === 'bar') {
                    hashParams.el_type = type;
                    hashParams.startChar = startChar;
                    hashParams.endChar = endChar;
                    if (impliedNaturals)
                        hashParams.accidentals = impliedNaturals.concat(hashParams.accidentals);
                    voice.push(hashParams);
                    return;
                }
                if (voice[i].el_type === type) {
                    hashParams.el_type = type;
                    hashParams.startChar = startChar;
                    hashParams.endChar = endChar;
                    if (impliedNaturals)
                        hashParams.accidentals = impliedNaturals.concat(hashParams.accidentals);
                    voice[i] = hashParams;
                    return;
                }
            }
        }
        staff[this.tune.staffNum][type] = hashParams2;
    }
    addSubtitle(str, info) {
        pushLine(this.tune, { subtitle: { text: str, startChar: info.startChar, endChar: info.endChar } });
    }
    addSpacing(num) {
        this.tune.vskipPending = num;
    }
    addNewPage(num) {
        pushLine(this.tune, { newpage: num });
    }
    addSeparator(spaceAbove, spaceBelow, lineLength, info) {
        pushLine(this.tune, { separator: { spaceAbove: Math.round(spaceAbove), spaceBelow: Math.round(spaceBelow), lineLength: Math.round(lineLength), startChar: info.startChar, endChar: info.endChar } });
    }
    addText(str, info) {
        pushLine(this.tune, { text: { text: str, startChar: info.startChar, endChar: info.endChar } });
    }
    addCentered(str) {
        pushLine(this.tune, { text: [{ text: str, center: true }] });
    }
    changeVoiceScale(scale) {
        this.appendElement('scale', null, null, { size: scale });
    }
    changeVoiceColor(color) {
        this.appendElement('color', null, null, { color: color });
    }
    startNewLine(params) {
        closeLine(this.tune);
        if (params.currentVoiceName) {
            this.currentVoiceName = params.currentVoiceName;
            this.voiceDefs[params.currentVoiceName] = params;
        }
        if (this.tune.lines[this.tune.lineNum] === undefined)
            createLine(this.tune, params);
        else if (this.tune.lines[this.tune.lineNum].staff === undefined) {
            this.tune.lineNum++;
            this.startNewLine(params);
        }
        else if (this.tune.lines[this.tune.lineNum].staff[this.tune.staffNum] === undefined)
            createStaff(this.tune, params);
        else if (this.tune.lines[this.tune.lineNum].staff[this.tune.staffNum].voices[this.tune.voiceNum] === undefined)
            createVoice(this.tune, params);
        else if (!containsNotes(this.tune.lines[this.tune.lineNum].staff[this.tune.staffNum].voices[this.tune.voiceNum])) {
            if (params.part)
                this.appendElement('part', params.part.startChar, params.part.endChar, { title: params.part.title });
        }
        else {
            this.tune.lineNum++;
            this.startNewLine(params);
        }
    }
    setRunningFont(type, font) {
        this.tune.runningFonts[type] = font;
    }
    setBarNumberImmediate(barNumber) {
        const currentVoice = this.getCurrentVoice();
        if (currentVoice && currentVoice.length > 0) {
            const lastElement = currentVoice[currentVoice.length - 1];
            if (lastElement.el_type === 'bar') {
                if (lastElement.barNumber !== undefined)
                    lastElement.barNumber = barNumber;
            }
            else
                return barNumber - 1;
        }
        return barNumber;
    }
    hasBeginMusic() {
        for (let i = 0; i < this.tune.lines.length; i++) {
            if (this.tune.lines[i].staff)
                return true;
        }
        return false;
    }
    isFirstLine(index) {
        for (let i = index - 1; i >= 0; i--) {
            if (this.tune.lines[i].staff !== undefined)
                return false;
        }
        return true;
    }
    getCurrentVoice() {
        const currLine = getPrevMusicLine(this.tune.lines, this.tune.lineNum);
        if (!currLine)
            return null;
        const currStaff = currLine.staff[this.tune.staffNum];
        if (!currStaff)
            return null;
        if (currStaff.voices[this.tune.voiceNum] !== undefined)
            return currStaff.voices[this.tune.voiceNum];
        else
            return null;
    }
    setCurrentVoice(staffNum, voiceNum, name) {
        this.tune.staffNum = staffNum;
        this.tune.voiceNum = voiceNum;
        this.currentVoiceName = name;
        let i = 0;
        for (; i < this.tune.lines.length; i++) {
            if (this.tune.lines[i].staff) {
                if (this.tune.lines[i].staff[staffNum] === undefined || this.tune.lines[i].staff[staffNum].voices[voiceNum] === undefined ||
                    !containsNotes(this.tune.lines[i].staff[staffNum].voices[voiceNum])) {
                    this.tune.lineNum = i;
                    if (!this.tune.lines[i].staff[staffNum] || !!this.tune.lines[i].staff[staffNum].voices[voiceNum])
                        return true;
                    return false;
                }
            }
        }
        this.tune.lineNum = i;
        return false;
    }
    addMetaText(key, value, info) {
        if (this.tune.metaText[key] === undefined) {
            this.tune.metaText[key] = value;
            this.tune.metaTextInfo[key] = info;
        }
        else {
            if (typeof this.tune.metaText[key] === 'string' && typeof value === 'string')
                this.tune.metaText[key] += "\n" + value;
            else {
                if (typeof this.tune.metaText[key] === 'string')
                    this.tune.metaText[key] = [{ text: this.tune.metaText[key] }];
                if (typeof value === 'string')
                    value = [{ text: value }];
                this.tune.metaText[key] = this.tune.metaText[key].concat(value);
            }
            this.tune.metaTextInfo[key].endChar = info.endChar;
        }
    }
    addMetaTextArray(key, value, info) {
        if (this.tune.metaText[key] === undefined) {
            this.tune.metaText[key] = [value];
            this.tune.metaTextInfo[key] = info;
        }
        else {
            this.tune.metaText[key].push(value);
            this.tune.metaTextInfo[key].endChar = info.endChar;
        }
    }
    addMetaTextObj(key, value, info) {
        this.tune.metaText[key] = value;
        this.tune.metaTextInfo[key] = info;
    }
}
function isArrayOfStrings(arr) {
    if (!arr)
        return false;
    if (typeof arr === "string")
        return false;
    for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] !== 'string')
            return false;
    }
    return true;
}
function simplifyMetaText(tune) {
    if (isArrayOfStrings(tune.metaText.notes))
        tune.metaText.notes = tune.metaText.notes.join("\n");
    if (isArrayOfStrings(tune.metaText.history))
        tune.metaText.history = tune.metaText.history.join("\n");
}
function resolveOverlays(tune) {
    let madeChanges = false;
    for (let i = 0; i < tune.lines.length; i++) {
        const line = tune.lines[i];
        if (line.staff) {
            for (let j = 0; j < line.staff.length; j++) {
                const staff = line.staff[j];
                const overlayVoice = [];
                for (let k = 0; k < staff.voices.length; k++) {
                    const voice = staff.voices[k];
                    overlayVoice.push({ hasOverlay: false, voice: [], snip: [] });
                    let durationThisBar = 0;
                    let inOverlay = false;
                    let snipStart = -1;
                    for (let kk = 0; kk < voice.length; kk++) {
                        const event = voice[kk];
                        if (event.el_type === "overlay" && !inOverlay) {
                            madeChanges = true;
                            inOverlay = true;
                            snipStart = kk;
                            overlayVoice[k].hasOverlay = true;
                            for (let ii = 0; ii < i; ii++) {
                                if (tune.lines[ii].staff) {
                                    tune.lines[ii].staff.forEach((s) => {
                                        if (staff.voices.length >= s.voices.length) {
                                            s.voices.forEach((v) => {
                                                let nv = [];
                                                v.forEach((ev) => {
                                                    if (ev.el_type === "bar") {
                                                        nv.push(ev);
                                                    }
                                                    else if (ev.el_type === "note") {
                                                        nv.push({
                                                            el_type: "note",
                                                            duration: ev.duration,
                                                            rest: { type: "invisible" },
                                                            startChar: ev.startChar,
                                                            endChar: ev.endChar
                                                        });
                                                    }
                                                });
                                                s.voices.push(nv);
                                            });
                                        }
                                    });
                                }
                            }
                        }
                        else if (event.el_type === "bar") {
                            if (inOverlay) {
                                inOverlay = false;
                                overlayVoice[k].snip.push({ start: snipStart, len: kk - snipStart });
                                overlayVoice[k].voice.push(event);
                            }
                            else {
                                if (durationThisBar > 0)
                                    overlayVoice[k].voice.push({ el_type: "note", duration: durationThisBar, rest: { type: "invisible" }, startChar: event.startChar, endChar: event.endChar });
                                overlayVoice[k].voice.push(event);
                            }
                            durationThisBar = 0;
                        }
                        else if (event.el_type === "note") {
                            if (inOverlay) {
                                overlayVoice[k].voice.push(event);
                            }
                            else if (!event.rest || event.rest.type !== 'spacer') {
                                durationThisBar += event.duration;
                            }
                        }
                        else if (event.el_type === "scale" || event.el_type === "stem" || event.el_type === "overlay" || event.el_type === "style" || event.el_type === "transpose" || event.el_type === "color") {
                            overlayVoice[k].voice.push(event);
                        }
                    }
                    if (overlayVoice[k].hasOverlay && overlayVoice[k].snip.length === 0) {
                        overlayVoice[k].snip.push({ start: snipStart, len: voice.length - snipStart });
                    }
                }
                for (let k = 0; k < overlayVoice.length; k++) {
                    const ov = overlayVoice[k];
                    if (ov.hasOverlay) {
                        ov.voice.splice(0, 0, { el_type: "stem", direction: "down" });
                        staff.voices.push(ov.voice);
                        for (let kkk = ov.snip.length - 1; kkk >= 0; kkk--) {
                            const snip = ov.snip[kkk];
                            staff.voices[k].splice(snip.start, snip.len);
                            staff.voices[k].splice(snip.start + 1, 0, { el_type: "stem", direction: "auto" });
                            const indexOfLastBar = findLastBar(staff.voices[k], snip.start);
                            staff.voices[k].splice(indexOfLastBar, 0, { el_type: "stem", direction: "up" });
                        }
                        for (let kkk = 0; kkk < staff.voices[staff.voices.length - 1].length; kkk++) {
                            staff.voices[staff.voices.length - 1][kkk] = Object.assign({}, staff.voices[staff.voices.length - 1][kkk]);
                            const el = staff.voices[staff.voices.length - 1][kkk];
                            if (el.el_type === 'bar' && el.startEnding) {
                                delete el.startEnding;
                            }
                            if (el.el_type === 'bar' && el.endEnding)
                                delete el.endEnding;
                        }
                    }
                }
            }
        }
    }
    return madeChanges;
}
function findLastBar(voice, start) {
    let i = start - 1;
    for (; i > 0 && voice[i].el_type !== "bar"; i--) {
    }
    return i;
}
function fixTitles(lines) {
    let firstMusicLine = true;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.staff) {
            for (let j = 0; j < line.staff.length; j++) {
                const staff = line.staff[j];
                if (staff.title) {
                    let hasATitle = false;
                    for (let k = 0; k < staff.title.length; k++) {
                        if (staff.title[k]) {
                            staff.title[k] = (firstMusicLine) ? staff.title[k].name : staff.title[k].subname;
                            if (staff.title[k])
                                hasATitle = true;
                            else
                                staff.title[k] = '';
                        }
                        else
                            staff.title[k] = '';
                    }
                    if (!hasATitle)
                        delete staff.title;
                }
            }
            firstMusicLine = false;
        }
    }
}
function cleanUpSlursInLine(line, staffNum, voiceNum, currSlur) {
    if (!currSlur[staffNum])
        currSlur[staffNum] = [];
    if (!currSlur[staffNum][voiceNum])
        currSlur[staffNum][voiceNum] = [];
    let x;
    const addEndSlur = function (obj, num, chordPos) {
        if (currSlur[staffNum][voiceNum][chordPos] === undefined) {
            for (x = 0; x < currSlur[staffNum][voiceNum].length; x++) {
                if (currSlur[staffNum][voiceNum][x] !== undefined) {
                    chordPos = x;
                    break;
                }
            }
            if (currSlur[staffNum][voiceNum][chordPos] === undefined) {
                let offNum = chordPos * 100 + 1;
                obj.endSlur.forEach(function (xs) { if (offNum === xs)
                    --offNum; });
                currSlur[staffNum][voiceNum][chordPos] = [offNum];
            }
        }
        let slurNum;
        for (let i = 0; i < num; i++) {
            slurNum = currSlur[staffNum][voiceNum][chordPos].pop();
            obj.endSlur.push(slurNum);
        }
        if (currSlur[staffNum][voiceNum][chordPos].length === 0)
            delete currSlur[staffNum][voiceNum][chordPos];
        return slurNum;
    };
    const addStartSlur = function (obj, num, chordPos, usedNums) {
        obj.startSlur = [];
        if (currSlur[staffNum][voiceNum][chordPos] === undefined) {
            currSlur[staffNum][voiceNum][chordPos] = [];
        }
        let nextNum = chordPos * 100 + 1;
        for (let i = 0; i < num; i++) {
            if (usedNums) {
                usedNums.forEach(function (xs) { if (nextNum === xs)
                    ++nextNum; });
                usedNums.forEach(function (xs) { if (nextNum === xs)
                    ++nextNum; });
                usedNums.forEach(function (xs) { if (nextNum === xs)
                    ++nextNum; });
            }
            currSlur[staffNum][voiceNum][chordPos].forEach(function (xs) { if (nextNum === xs)
                ++nextNum; });
            currSlur[staffNum][voiceNum][chordPos].forEach(function (xs) { if (nextNum === xs)
                ++nextNum; });
            currSlur[staffNum][voiceNum][chordPos].push(nextNum);
            obj.startSlur.push({ label: nextNum });
            if (obj.dottedSlur) {
                obj.startSlur[obj.startSlur.length - 1].style = 'dotted';
                delete obj.dottedSlur;
            }
            nextNum++;
        }
    };
    for (let i = 0; i < line.length; i++) {
        const el = line[i];
        if (el.el_type === 'note') {
            if (el.gracenotes) {
                for (let g = 0; g < el.gracenotes.length; g++) {
                    if (el.gracenotes[g].endSlur) {
                        const gg = el.gracenotes[g].endSlur;
                        el.gracenotes[g].endSlur = [];
                        for (let ggg = 0; ggg < gg; ggg++)
                            addEndSlur(el.gracenotes[g], 1, 20);
                    }
                    if (el.gracenotes[g].startSlur) {
                        x = el.gracenotes[g].startSlur;
                        addStartSlur(el.gracenotes[g], x, 20);
                    }
                }
            }
            if (el.endSlur) {
                x = el.endSlur;
                el.endSlur = [];
                addEndSlur(el, x, 0);
            }
            if (el.startSlur) {
                x = el.startSlur;
                addStartSlur(el, x, 0);
            }
            if (el.pitches) {
                const usedNums = [];
                for (let p = 0; p < el.pitches.length; p++) {
                    if (el.pitches[p].endSlur) {
                        const k = el.pitches[p].endSlur;
                        el.pitches[p].endSlur = [];
                        for (let j = 0; j < k; j++) {
                            const slurNum = addEndSlur(el.pitches[p], 1, p + 1);
                            usedNums.push(slurNum);
                        }
                    }
                }
                for (let p = 0; p < el.pitches.length; p++) {
                    if (el.pitches[p].startSlur) {
                        x = el.pitches[p].startSlur;
                        addStartSlur(el.pitches[p], x, p + 1, usedNums);
                    }
                }
                if (el.gracenotes && el.pitches[0].endSlur && el.pitches[0].endSlur[0] === 100 && el.pitches[0].startSlur) {
                    if (el.gracenotes[0].endSlur)
                        el.gracenotes[0].endSlur.push(el.pitches[0].startSlur[0].label);
                    else
                        el.gracenotes[0].endSlur = [el.pitches[0].startSlur[0].label];
                    if (el.pitches[0].endSlur.length === 1)
                        delete el.pitches[0].endSlur;
                    else if (el.pitches[0].endSlur[0] === 100)
                        el.pitches[0].endSlur.shift();
                    else if (el.pitches[0].endSlur[el.pitches[0].endSlur.length - 1] === 100)
                        el.pitches[0].endSlur.pop();
                    if (currSlur[staffNum][voiceNum][1].length === 1)
                        delete currSlur[staffNum][voiceNum][1];
                    else
                        currSlur[staffNum][voiceNum][1].pop();
                }
            }
        }
    }
}
function wrapMusicLines(lines, barsperstaff) {
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].staff !== undefined) {
            for (let s = 0; s < lines[i].staff.length; s++) {
                const permanentItems = [];
                for (let v = 0; v < lines[i].staff[s].voices.length; v++) {
                    const voice = lines[i].staff[s].voices[v];
                    let barNumThisLine = 0;
                    for (let n = 0; n < voice.length; n++) {
                        if (voice[n].el_type === 'bar') {
                            barNumThisLine++;
                            if (barNumThisLine >= barsperstaff) {
                                if (n < voice.length - 1) {
                                    let nextLine = getNextMusicLine(lines, i);
                                    if (!nextLine) {
                                        const cp = JSON.parse(JSON.stringify(lines[i]));
                                        lines.push(Object.assign({}, cp));
                                        nextLine = lines[lines.length - 1];
                                        for (let ss = 0; ss < nextLine.staff.length; ss++) {
                                            for (let vv = 0; vv < nextLine.staff[ss].voices.length; vv++)
                                                nextLine.staff[ss].voices[vv] = [];
                                        }
                                    }
                                    const startElement = n + 1;
                                    const section = lines[i].staff[s].voices[v].slice(startElement);
                                    lines[i].staff[s].voices[v] = lines[i].staff[s].voices[v].slice(0, startElement);
                                    nextLine.staff[s].voices[v] = permanentItems.concat(section.concat(nextLine.staff[s].voices[v]));
                                    return true;
                                }
                            }
                        }
                        else if (!voice[n].duration) {
                            permanentItems.push(voice[n]);
                        }
                    }
                }
            }
        }
    }
    return false;
}
function getPrevMusicLine(lines, currentLine) {
    if (lines.length <= currentLine)
        return null;
    while (currentLine >= 0) {
        if (lines[currentLine].staff)
            return lines[currentLine];
        currentLine--;
    }
    return null;
}
function getNextMusicLine(lines, currentLine) {
    currentLine++;
    while (lines.length > currentLine) {
        if (lines[currentLine].staff)
            return lines[currentLine];
        currentLine++;
    }
    return null;
}
function getLastNote(tune) {
    if (!tune.lines[tune.lineNum])
        return null;
    if (!tune.lines[tune.lineNum].staff)
        return null;
    if (!tune.lines[tune.lineNum].staff[tune.staffNum])
        return null;
    const voice = tune.lines[tune.lineNum].staff[tune.staffNum].voices[tune.voiceNum];
    if (!voice)
        return null;
    for (let i = voice.length - 1; i >= 0; i--) {
        const el = voice[i];
        if (el.el_type === 'note') {
            return el;
        }
    }
    return null;
}
function getDuration(el) {
    if (el.duration)
        return el.duration;
    return 0;
}
function closeLine(tune) {
    if (tune.potentialStartBeam && tune.potentialEndBeam) {
        tune.potentialStartBeam.startBeam = true;
        tune.potentialEndBeam.endBeam = true;
    }
    delete tune.potentialStartBeam;
    delete tune.potentialEndBeam;
}
function containsNotes(voice) {
    for (let i = 0; i < voice.length; i++) {
        if (voice[i].el_type === 'note' || voice[i].el_type === 'bar')
            return true;
    }
    return false;
}
function containsNotesStrict(voice) {
    for (let i = 0; i < voice.length; i++) {
        if (voice[i].el_type === 'note' && (voice[i].rest === undefined || voice[i].chord !== undefined))
            return true;
    }
    return false;
}
function pushLine(tune, hash) {
    if (tune.vskipPending) {
        hash.vskip = tune.vskipPending;
        delete tune.vskipPending;
    }
    tune.lines.push(hash);
}
function pushNote(tune, hp, voiceDefs, currentVoiceName) {
    const currStaff = tune.lines[tune.lineNum].staff[tune.staffNum];
    if (hp.pitches !== undefined) {
        const mid = currStaff.workingClef.verticalPos;
        hp.pitches.forEach(function (p) { p.verticalPos = p.pitch - mid; });
    }
    if (hp.gracenotes !== undefined) {
        const mid2 = currStaff.workingClef.verticalPos;
        hp.gracenotes.forEach(function (p) { p.verticalPos = p.pitch - mid2; });
    }
    if (currStaff.voices.length <= tune.voiceNum) {
        if (!voiceDefs[currentVoiceName])
            voiceDefs[currentVoiceName] = {};
        createVoice(tune, voiceDefs[currentVoiceName]);
    }
    currStaff.voices[tune.voiceNum].push(hp);
}
function endBeamHere(hashParams, tune) {
    tune.potentialStartBeam.startBeam = true;
    hashParams.endBeam = true;
    delete tune.potentialStartBeam;
    delete tune.potentialEndBeam;
}
function endBeamLast(tune) {
    if (tune.potentialStartBeam !== undefined && tune.potentialEndBeam !== undefined) {
        tune.potentialStartBeam.startBeam = true;
        tune.potentialEndBeam.endBeam = true;
    }
    delete tune.potentialStartBeam;
    delete tune.potentialEndBeam;
}
function setLineFont(tune, type, font) {
    if (tune.runningFonts[type]) {
        let isDifferent = false;
        const keys = Object.keys(font);
        for (let i = 0; i < keys.length; i++) {
            if (tune.runningFonts[type][keys[i]] !== font[keys[i]])
                isDifferent = true;
        }
        if (isDifferent) {
            tune.lines[tune.lineNum].staff[tune.staffNum][type] = font;
        }
    }
    tune.runningFonts[type] = font;
}
function createVoice(tune, params) {
    const thisStaff = tune.lines[tune.lineNum].staff[tune.staffNum];
    thisStaff.voices[tune.voiceNum] = [];
    if (!thisStaff.title)
        thisStaff.title = [];
    thisStaff.title[tune.voiceNum] = { name: params.name, subname: params.subname };
    if (params.style)
        appendElementHelper(tune, 'style', null, null, { head: params.style });
    if (params.stem)
        appendElementHelper(tune, 'stem', null, null, { direction: params.stem });
    else if (tune.voiceNum > 0) {
        if (thisStaff.voices[0] !== undefined) {
            let found = false;
            for (let i = 0; i < thisStaff.voices[0].length; i++) {
                if (thisStaff.voices[0][i] && thisStaff.voices[0][i].el_type === 'stem')
                    found = true;
            }
            if (!found) {
                const stem = { el_type: 'stem', direction: 'up' };
                thisStaff.voices[0].splice(0, 0, stem);
            }
        }
        appendElementHelper(tune, 'stem', null, null, { direction: 'down' });
    }
    if (params.scale)
        appendElementHelper(tune, 'scale', null, null, { size: params.scale });
    if (params.color)
        appendElementHelper(tune, 'color', null, null, { color: params.color });
}
function createStaff(tune, params) {
    if (params.key && params.key.impliedNaturals) {
        params.key.accidentals = params.key.accidentals.concat(params.key.impliedNaturals);
        delete params.key.impliedNaturals;
    }
    tune.lines[tune.lineNum].staff[tune.staffNum] = { voices: [], clef: params.clef, key: params.key, workingClef: params.clef };
    const staff = tune.lines[tune.lineNum].staff[tune.staffNum];
    if (params.stafflines !== undefined) {
        staff.clef.stafflines = params.stafflines;
        staff.workingClef.stafflines = params.stafflines;
    }
    if (params.staffscale) {
        staff.staffscale = params.staffscale;
    }
    if (params.annotationfont)
        setLineFont(tune, "annotationfont", params.annotationfont);
    if (params.gchordfont)
        setLineFont(tune, "gchordfont", params.gchordfont);
    if (params.tripletfont)
        setLineFont(tune, "tripletfont", params.tripletfont);
    if (params.vocalfont)
        setLineFont(tune, "vocalfont", params.vocalfont);
    if (params.bracket)
        staff.bracket = params.bracket;
    if (params.brace)
        staff.brace = params.brace;
    if (params.connectBarLines)
        staff.connectBarLines = params.connectBarLines;
    if (params.barNumber)
        staff.barNumber = params.barNumber;
    createVoice(tune, params);
    if (params.part)
        appendElementHelper(tune, 'part', params.part.startChar, params.part.endChar, { title: params.part.title });
    if (params.meter !== undefined)
        staff.meter = params.meter;
    if (tune.vskipPending) {
        tune.lines[tune.lineNum].vskip = tune.vskipPending;
        delete tune.vskipPending;
    }
}
function createLine(tune, params) {
    tune.lines[tune.lineNum] = { staff: [] };
    createStaff(tune, params);
}
function voiceUseful(lines, voiceNum) {
    let isUseful = false;
    let voiceExists = false;
    for (let line = 0; line < lines.length; line++) {
        const staves = lines[line].staff;
        if (staves) {
            for (let s = 0; s < staves.length; s++) {
                const staff = staves[s];
                if (voiceNum < staff.voices.length) {
                    voiceExists = true;
                    const voice = staff.voices[voiceNum];
                    for (let e = 0; e < voice.length; e++) {
                        const el = voice[e];
                        if (el.el_type === 'note' && (!el.rest || el.chord))
                            isUseful = true;
                    }
                }
            }
        }
    }
    if (!voiceExists)
        return 'not-found';
    return isUseful;
}
function deleteVoice(lines, voiceNum) {
    for (let line = 0; line < lines.length; line++) {
        const staves = lines[line].staff;
        if (staves) {
            for (let s = 0; s < staves.length; s++) {
                const staff = staves[s];
                if (voiceNum < staff.voices.length) {
                    staff.voices.splice(voiceNum, 1);
                }
            }
        }
    }
}
// Helper to replace `self.appendElement` in top-level functions that lack reference to `this`
function appendElementHelper(tune, type, startChar, endChar, hashParams) {
    hashParams.el_type = type;
    if (startChar !== null)
        hashParams.startChar = startChar;
    if (endChar !== null)
        hashParams.endChar = endChar;
    const currStaff = tune.lines[tune.lineNum].staff[tune.staffNum];
    if (currStaff && currStaff.voices[tune.voiceNum]) {
        currStaff.voices[tune.voiceNum].push(hashParams);
    }
}
