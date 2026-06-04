import parseDirective from './abc_parse_directive';
import transpose from './abc_transpose';
let tokenizer;
let warn;
let multilineVars;
let tune;
let tuneBuilder;
const clefLines = {
    'treble': { clef: 'treble', pitch: 4, mid: 0 },
    'treble+8': { clef: 'treble+8', pitch: 4, mid: 0 },
    'treble-8': { clef: 'treble-8', pitch: 4, mid: 0 },
    'treble^8': { clef: 'treble+8', pitch: 4, mid: 0 },
    'treble_8': { clef: 'treble-8', pitch: 4, mid: 0 },
    'treble1': { clef: 'treble', pitch: 2, mid: 2 },
    'treble2': { clef: 'treble', pitch: 4, mid: 0 },
    'treble3': { clef: 'treble', pitch: 6, mid: -2 },
    'treble4': { clef: 'treble', pitch: 8, mid: -4 },
    'treble5': { clef: 'treble', pitch: 10, mid: -6 },
    'perc': { clef: 'perc', pitch: 6, mid: 0 },
    'none': { clef: 'none', mid: 0 },
    'bass': { clef: 'bass', pitch: 8, mid: -12 },
    'bass+8': { clef: 'bass+8', pitch: 8, mid: -12 },
    'bass-8': { clef: 'bass-8', pitch: 8, mid: -12 },
    'bass^8': { clef: 'bass+8', pitch: 8, mid: -12 },
    'bass_8': { clef: 'bass-8', pitch: 8, mid: -12 },
    'bass+16': { clef: 'bass', pitch: 8, mid: -12 },
    'bass-16': { clef: 'bass', pitch: 8, mid: -12 },
    'bass^16': { clef: 'bass', pitch: 8, mid: -12 },
    'bass_16': { clef: 'bass', pitch: 8, mid: -12 },
    'bass1': { clef: 'bass', pitch: 2, mid: -6 },
    'bass2': { clef: 'bass', pitch: 4, mid: -8 },
    'bass3': { clef: 'bass', pitch: 6, mid: -10 },
    'bass4': { clef: 'bass', pitch: 8, mid: -12 },
    'bass5': { clef: 'bass', pitch: 10, mid: -14 },
    'tenor': { clef: 'alto', pitch: 8, mid: -8 },
    'tenor1': { clef: 'alto', pitch: 2, mid: -2 },
    'tenor2': { clef: 'alto', pitch: 4, mid: -4 },
    'tenor3': { clef: 'alto', pitch: 6, mid: -6 },
    'tenor4': { clef: 'alto', pitch: 8, mid: -8 },
    'tenor5': { clef: 'alto', pitch: 10, mid: -10 },
    'alto': { clef: 'alto', pitch: 6, mid: -6 },
    'alto1': { clef: 'alto', pitch: 2, mid: -2 },
    'alto2': { clef: 'alto', pitch: 4, mid: -4 },
    'alto3': { clef: 'alto', pitch: 6, mid: -6 },
    'alto4': { clef: 'alto', pitch: 8, mid: -8 },
    'alto5': { clef: 'alto', pitch: 10, mid: -10 },
    'alto+8': { clef: 'alto+8', pitch: 6, mid: -6 },
    'alto-8': { clef: 'alto-8', pitch: 6, mid: -6 },
    'alto^8': { clef: 'alto+8', pitch: 6, mid: -6 },
    'alto_8': { clef: 'alto-8', pitch: 6, mid: -6 }
};
const pitches = { A: 5, B: 6, C: 0, D: 1, E: 2, F: 3, G: 4, a: 12, b: 13, c: 7, d: 8, e: 9, f: 10, g: 11 };
function calcMiddle(clef, oct) {
    const value = clefLines[clef];
    const mid = value ? value.mid : 0;
    return mid + oct;
}
function parseMiddle(str) {
    let i = 0;
    let p = str[i++];
    if (p === '^' || p === '_')
        p = str[i++];
    let mid = pitches[p];
    if (mid === undefined)
        mid = 6;
    for (; i < str.length; i++) {
        if (str[i] === ',')
            mid -= 7;
        else if (str[i] === "'")
            mid += 7;
        else
            break;
    }
    return { mid: mid - 6, str: str.substring(i) };
}
function normalizeAccidentals(accs) {
    for (let i = 0; i < accs.length; i++) {
        if (accs[i].note === 'b')
            accs[i].note = 'B';
        else if (accs[i].note === 'a')
            accs[i].note = 'A';
        else if (accs[i].note === 'F')
            accs[i].note = 'f';
        else if (accs[i].note === 'E')
            accs[i].note = 'e';
        else if (accs[i].note === 'D')
            accs[i].note = 'd';
        else if (accs[i].note === 'C')
            accs[i].note = 'c';
        else if (accs[i].note === 'G' && accs[i].acc === 'sharp')
            accs[i].note = 'g';
        else if (accs[i].note === 'g' && accs[i].acc === 'flat')
            accs[i].note = 'G';
    }
}
const parseKeyVoice = {
    initialize: function (tokenizer_, warn_, multilineVars_, tune_, tuneBuilder_) {
        tokenizer = tokenizer_;
        warn = warn_;
        multilineVars = multilineVars_;
        tune = tune_;
        tuneBuilder = tuneBuilder_;
    },
    standardKey: function (keyName, root, acc, localTranspose) {
        return transpose.keySignature(multilineVars, keyName, root, acc, localTranspose);
    },
    fixClef: function (clef) {
        const value = clefLines[clef.type];
        if (value) {
            clef.clefPos = value.pitch;
            clef.type = value.clef;
        }
    },
    deepCopyKey: function (key) {
        const ret = { accidentals: [], root: key.root, acc: key.acc, mode: key.mode };
        if (key.accidentals) {
            key.accidentals.forEach(function (k) {
                ret.accidentals.push(Object.assign({}, k));
            });
        }
        return ret;
    },
    addPosToKey: function (clef, key) {
        const mid = clef.verticalPos;
        key.accidentals.forEach(function (acc) {
            let pitch = pitches[acc.note];
            pitch = pitch - mid;
            acc.verticalPos = pitch;
        });
        if (key.impliedNaturals)
            key.impliedNaturals.forEach(function (acc) {
                let pitch = pitches[acc.note];
                pitch = pitch - mid;
                acc.verticalPos = pitch;
            });
        if (mid < -10) {
            key.accidentals.forEach(function (acc) {
                acc.verticalPos -= 7;
                if (acc.verticalPos >= 11 || (acc.verticalPos === 10 && acc.acc === 'flat'))
                    acc.verticalPos -= 7;
                if (acc.note === 'A' && acc.acc === 'sharp')
                    acc.verticalPos -= 7;
                if ((acc.note === 'G' || acc.note === 'F') && acc.acc === 'flat')
                    acc.verticalPos -= 7;
            });
            if (key.impliedNaturals)
                key.impliedNaturals.forEach(function (acc) {
                    acc.verticalPos -= 7;
                    if (acc.verticalPos >= 11 || (acc.verticalPos === 10 && acc.acc === 'flat'))
                        acc.verticalPos -= 7;
                    if (acc.note === 'A' && acc.acc === 'sharp')
                        acc.verticalPos -= 7;
                    if ((acc.note === 'G' || acc.note === 'F') && acc.acc === 'flat')
                        acc.verticalPos -= 7;
                });
        }
        else if (mid < -4) {
            key.accidentals.forEach(function (acc) {
                acc.verticalPos -= 7;
                if (mid === -8 && (acc.note === 'f' || acc.note === 'g') && acc.acc === 'sharp')
                    acc.verticalPos -= 7;
            });
            if (key.impliedNaturals)
                key.impliedNaturals.forEach(function (acc) {
                    acc.verticalPos -= 7;
                    if (mid === -8 && (acc.note === 'f' || acc.note === 'g') && acc.acc === 'sharp')
                        acc.verticalPos -= 7;
                });
        }
        else if (mid >= 7) {
            key.accidentals.forEach(function (acc) {
                acc.verticalPos += 7;
            });
            if (key.impliedNaturals)
                key.impliedNaturals.forEach(function (acc) {
                    acc.verticalPos += 7;
                });
        }
    },
    fixKey: function (clef, key) {
        const fixedKey = Object.assign({}, key);
        parseKeyVoice.addPosToKey(clef, fixedKey);
        return fixedKey;
    },
    parseKey: function (str, isInline) {
        if (str.length === 0) {
            str = 'none';
        }
        const tokens = tokenizer.tokenize(str, 0, str.length);
        const ret = {};
        if (tokens.length === 0) {
            warn("Must pass in key signature.", str, 0);
            return ret;
        }
        switch (tokens[0].token) {
            case 'HP':
                parseDirective.addDirective("bagpipes");
                multilineVars.key = { root: "HP", accidentals: [], acc: "", mode: "" };
                ret.foundKey = true;
                tokens.shift();
                break;
            case 'Hp':
                parseDirective.addDirective("bagpipes");
                multilineVars.key = { root: "Hp", accidentals: [{ acc: 'natural', note: 'g' }, { acc: 'sharp', note: 'f' }, { acc: 'sharp', note: 'c' }], acc: "", mode: "" };
                ret.foundKey = true;
                tokens.shift();
                break;
            case 'none':
                multilineVars.key = { root: "none", accidentals: [], acc: "", mode: "" };
                ret.foundKey = true;
                tokens.shift();
                break;
            default:
                const retPitch = tokenizer.getKeyPitch(tokens[0].token);
                if (retPitch.len > 0) {
                    ret.foundKey = true;
                    let acc = "";
                    let mode = "";
                    if (tokens[0].token.length > 1)
                        tokens[0].token = tokens[0].token.substring(1);
                    else
                        tokens.shift();
                    let keyName = retPitch.token;
                    if (tokens.length > 0) {
                        const retAcc = tokenizer.getSharpFlat(tokens[0].token);
                        if (retAcc.len > 0) {
                            if (tokens[0].token.length > 1)
                                tokens[0].token = tokens[0].token.substring(1);
                            else
                                tokens.shift();
                            keyName += retAcc.token;
                            acc = retAcc.token;
                        }
                        if (tokens.length > 0) {
                            const retMode = tokenizer.getMode(tokens[0].token);
                            if (retMode.len > 0) {
                                tokens.shift();
                                keyName += retMode.token;
                                mode = retMode.token;
                            }
                        }
                        if (parseKeyVoice.standardKey(keyName, retPitch.token, acc, 0) === undefined) {
                            warn("Unsupported key signature: " + keyName, str, 0);
                            return ret;
                        }
                    }
                    const oldKey = parseKeyVoice.deepCopyKey(multilineVars.key);
                    const keyCompensate = !isInline && multilineVars.globalTranspose ? -multilineVars.globalTranspose : 0;
                    let savedOrigKey;
                    if (isInline)
                        savedOrigKey = multilineVars.globalTransposeOrigKeySig;
                    multilineVars.key = parseKeyVoice.deepCopyKey(parseKeyVoice.standardKey(keyName, retPitch.token, acc, keyCompensate));
                    if (isInline)
                        multilineVars.globalTransposeOrigKeySig = savedOrigKey;
                    multilineVars.key.mode = mode;
                    if (oldKey && multilineVars.keywarn !== false) {
                        let kk;
                        for (let k = 0; k < multilineVars.key.accidentals.length; k++) {
                            for (kk = 0; kk < oldKey.accidentals.length; kk++) {
                                if (oldKey.accidentals[kk].note && multilineVars.key.accidentals[k].note.toLowerCase() === oldKey.accidentals[kk].note.toLowerCase())
                                    oldKey.accidentals[kk].note = null;
                            }
                        }
                        for (kk = 0; kk < oldKey.accidentals.length; kk++) {
                            if (oldKey.accidentals[kk].note) {
                                if (!multilineVars.key.impliedNaturals)
                                    multilineVars.key.impliedNaturals = [];
                                multilineVars.key.impliedNaturals.push({ acc: 'natural', note: oldKey.accidentals[kk].note });
                            }
                        }
                    }
                }
                break;
        }
        if (tokens.length === 0)
            return ret;
        if (tokens[0].token === 'exp')
            tokens.shift();
        if (tokens.length === 0)
            return ret;
        if (tokens[0].token === 'oct')
            tokens.shift();
        if (tokens.length === 0)
            return ret;
        const accs = tokenizer.getKeyAccidentals2(tokens);
        if (accs.warn)
            warn(accs.warn, str, 0);
        if (accs.accs) {
            if (!ret.foundKey) {
                ret.foundKey = true;
                multilineVars.key = { root: "none", acc: "", mode: "", accidentals: [] };
            }
            normalizeAccidentals(accs.accs);
            for (let i = 0; i < accs.accs.length; i++) {
                let found = false;
                for (let j = 0; j < multilineVars.key.accidentals.length && !found; j++) {
                    if (multilineVars.key.accidentals[j].note === accs.accs[i].note) {
                        found = true;
                        if (multilineVars.key.accidentals[j].acc !== accs.accs[i].acc) {
                            multilineVars.key.accidentals[j].acc = accs.accs[i].acc;
                            if (!multilineVars.key.explicitAccidentals)
                                multilineVars.key.explicitAccidentals = [];
                            multilineVars.key.explicitAccidentals.push(accs.accs[i]);
                        }
                    }
                }
                if (!found) {
                    if (!multilineVars.key.explicitAccidentals)
                        multilineVars.key.explicitAccidentals = [];
                    multilineVars.key.explicitAccidentals.push(accs.accs[i]);
                    multilineVars.key.accidentals.push(accs.accs[i]);
                    if (multilineVars.key.impliedNaturals) {
                        for (let kkk = 0; kkk < multilineVars.key.impliedNaturals.length; kkk++) {
                            if (multilineVars.key.impliedNaturals[kkk].note === accs.accs[i].note)
                                multilineVars.key.impliedNaturals.splice(kkk, 1);
                        }
                    }
                }
            }
        }
        let token;
        while (tokens.length > 0) {
            switch (tokens[0].token) {
                case "m":
                case "middle":
                    tokens.shift();
                    if (tokens.length === 0) {
                        warn("Expected = after middle", str, 0);
                        return ret;
                    }
                    token = tokens.shift();
                    if (token.token !== "=") {
                        warn("Expected = after middle", str, token.start);
                        break;
                    }
                    if (tokens.length === 0) {
                        warn("Expected parameter after middle=", str, 0);
                        return ret;
                    }
                    const pitch = tokenizer.getPitchFromTokens(tokens);
                    if (pitch.warn)
                        warn(pitch.warn, str, 0);
                    if (pitch.position)
                        multilineVars.clef.verticalPos = pitch.position - 6;
                    break;
                case "transpose":
                    tokens.shift();
                    if (tokens.length === 0) {
                        warn("Expected = after transpose", str, 0);
                        return ret;
                    }
                    token = tokens.shift();
                    if (token.token !== "=") {
                        warn("Expected = after transpose", str, token.start);
                        break;
                    }
                    if (tokens.length === 0) {
                        warn("Expected parameter after transpose=", str, 0);
                        return ret;
                    }
                    if (tokens[0].type !== 'number') {
                        warn("Expected number after transpose", str, tokens[0].start);
                        break;
                    }
                    multilineVars.clef.transpose = tokens[0].intt;
                    tokens.shift();
                    break;
                case "stafflines":
                    tokens.shift();
                    if (tokens.length === 0) {
                        warn("Expected = after stafflines", str, 0);
                        return ret;
                    }
                    token = tokens.shift();
                    if (token.token !== "=") {
                        warn("Expected = after stafflines", str, token.start);
                        break;
                    }
                    if (tokens.length === 0) {
                        warn("Expected parameter after stafflines=", str, 0);
                        return ret;
                    }
                    if (tokens[0].type !== 'number') {
                        warn("Expected number after stafflines", str, tokens[0].start);
                        break;
                    }
                    multilineVars.clef.stafflines = tokens[0].intt;
                    tokens.shift();
                    break;
                case "staffscale":
                    tokens.shift();
                    if (tokens.length === 0) {
                        warn("Expected = after staffscale", str, 0);
                        return ret;
                    }
                    token = tokens.shift();
                    if (token.token !== "=") {
                        warn("Expected = after staffscale", str, token.start);
                        break;
                    }
                    if (tokens.length === 0) {
                        warn("Expected parameter after staffscale=", str, 0);
                        return ret;
                    }
                    if (tokens[0].type !== 'number') {
                        warn("Expected number after staffscale", str, tokens[0].start);
                        break;
                    }
                    multilineVars.clef.staffscale = tokens[0].floatt;
                    tokens.shift();
                    break;
                case "octave":
                    tokens.shift();
                    if (tokens.length === 0) {
                        warn("Expected = after octave", str, 0);
                        return ret;
                    }
                    token = tokens.shift();
                    if (token.token !== "=") {
                        warn("Expected = after octave", str, token.start);
                        break;
                    }
                    if (tokens.length === 0) {
                        warn("Expected parameter after octave=", str, 0);
                        return ret;
                    }
                    if (tokens[0].type !== 'number') {
                        warn("Expected number after octave", str, tokens[0].start);
                        break;
                    }
                    multilineVars.octave = tokens[0].intt;
                    tokens.shift();
                    break;
                case "style":
                    tokens.shift();
                    if (tokens.length === 0) {
                        warn("Expected = after style", str, 0);
                        return ret;
                    }
                    token = tokens.shift();
                    if (token.token !== "=") {
                        warn("Expected = after style", str, token.start);
                        break;
                    }
                    if (tokens.length === 0) {
                        warn("Expected parameter after style=", str, 0);
                        return ret;
                    }
                    switch (tokens[0].token) {
                        case "normal":
                        case "harmonic":
                        case "rhythm":
                        case "x":
                        case "triangle":
                            multilineVars.style = tokens[0].token;
                            tokens.shift();
                            break;
                        default:
                            warn("error parsing style element: " + tokens[0].token, str, tokens[0].start);
                            break;
                    }
                    break;
                case "clef":
                    tokens.shift();
                    if (tokens.length === 0) {
                        warn("Expected = after clef", str, 0);
                        return ret;
                    }
                    token = tokens.shift();
                    if (token.token !== "=") {
                        warn("Expected = after clef", str, token.start);
                        break;
                    }
                    if (tokens.length === 0) {
                        warn("Expected parameter after clef=", str, 0);
                        return ret;
                    }
                case "treble":
                case "bass":
                case "alto":
                case "tenor":
                case "perc":
                case "none":
                    let clef = tokens.shift();
                    switch (clef.token) {
                        case 'treble':
                        case 'tenor':
                        case 'alto':
                        case 'bass':
                        case 'perc':
                        case 'none':
                            break;
                        case 'C':
                            clef.token = 'alto';
                            break;
                        case 'F':
                            clef.token = 'bass';
                            break;
                        case 'G':
                            clef.token = 'treble';
                            break;
                        case 'c':
                            clef.token = 'alto';
                            break;
                        case 'f':
                            clef.token = 'bass';
                            break;
                        case 'g':
                            clef.token = 'treble';
                            break;
                        default:
                            warn("Expected clef name. Found " + clef.token, str, clef.start);
                            break;
                    }
                    if (tokens.length > 0 && tokens[0].type === 'number') {
                        clef.token += tokens[0].token;
                        tokens.shift();
                    }
                    if (tokens.length > 1 && (tokens[0].token === '-' || tokens[0].token === '+' || tokens[0].token === '^' || tokens[0].token === '_') && tokens[1].token === '8') {
                        clef.token += tokens[0].token + tokens[1].token;
                        tokens.shift();
                        tokens.shift();
                    }
                    multilineVars.clef = { type: clef.token, verticalPos: calcMiddle(clef.token, 0) };
                    if (multilineVars.currentVoice && multilineVars.currentVoice.transpose !== undefined)
                        multilineVars.clef.transpose = multilineVars.currentVoice.transpose;
                    ret.foundClef = true;
                    break;
                default:
                    warn("Unknown parameter: " + tokens[0].token, str, tokens[0].start);
                    tokens.shift();
            }
        }
        return ret;
    },
    parseVoice: function (line, i, e) {
        const ret = tokenizer.getMeat(line, i, e);
        let start = ret.start;
        const end = ret.end;
        const id = tokenizer.getToken(line, start, end);
        if (id.length === 0) {
            warn("Expected a voice id", line, start);
            return;
        }
        let isNew = false;
        if (multilineVars.voices[id] === undefined) {
            multilineVars.voices[id] = {};
            isNew = true;
            if (multilineVars.score_is_present)
                warn("Can't have an unknown V: id when the %score directive is present", line, start);
        }
        start += id.length;
        start += tokenizer.eatWhiteSpace(line, start);
        const staffInfo = { startStaff: isNew };
        const addNextTokenToStaffInfo = function (name) {
            const attr = tokenizer.getVoiceToken(line, start, end);
            if (attr.warn !== undefined)
                warn("Expected value for " + name + " in voice: " + attr.warn, line, start);
            else if (attr.err !== undefined)
                warn("Expected value for " + name + " in voice: " + attr.err, line, start);
            else if (attr.token.length === 0 && line[start] !== '"')
                warn("Expected value for " + name + " in voice", line, start);
            else
                staffInfo[name] = attr.token;
            start += attr.len;
        };
        const addNextTokenToVoiceInfo = function (vid, name, type) {
            const attr = tokenizer.getVoiceToken(line, start, end);
            if (attr.warn !== undefined)
                warn("Expected value for " + name + " in voice: " + attr.warn, line, start);
            else if (attr.err !== undefined)
                warn("Expected value for " + name + " in voice: " + attr.err, line, start);
            else if (attr.token.length === 0 && line[start] !== '"')
                warn("Expected value for " + name + " in voice", line, start);
            else {
                if (type === 'number')
                    attr.token = parseFloat(attr.token);
                multilineVars.voices[vid][name] = attr.token;
            }
            start += attr.len;
        };
        const getNextToken = function (name, type) {
            const attr = tokenizer.getVoiceToken(line, start, end);
            if (attr.warn !== undefined)
                warn("Expected value for " + name + " in voice: " + attr.warn, line, start);
            else if (attr.err !== undefined)
                warn("Expected value for " + name + " in voice: " + attr.err, line, start);
            else if (attr.token.length === 0 && line[start] !== '"')
                warn("Expected value for " + name + " in voice", line, start);
            else {
                if (type === 'number')
                    attr.token = parseFloat(attr.token);
                return attr.token;
            }
            start += attr.len;
        };
        const addNextNoteTokenToVoiceInfo = function (vid, name) {
            const noteToTransposition = {
                "_B": 2,
                "_E": 9,
                "_b": -10,
                "_e": -3
            };
            const attr = tokenizer.getVoiceToken(line, start, end);
            if (attr.warn !== undefined)
                warn("Expected one of (_B, _E, _b, _e) for " + name + " in voice: " + attr.warn, line, start);
            else if (attr.token.length === 0 && line[start] !== '"')
                warn("Expected one of (_B, _E, _b, _e) for " + name + " in voice", line, start);
            else {
                const t = noteToTransposition[attr.token];
                if (!t)
                    warn("Expected one of (_B, _E, _b, _e) for " + name + " in voice", line, start);
                else
                    multilineVars.voices[vid][name] = t;
            }
            start += attr.len;
        };
        while (start < end) {
            const token = tokenizer.getVoiceToken(line, start, end);
            start += token.len;
            if (token.warn) {
                warn("Error parsing voice: " + token.warn, line, start);
            }
            else {
                let attr = null;
                switch (token.token) {
                    case 'clef':
                    case 'cl':
                        addNextTokenToStaffInfo('clef');
                        let oct = 0;
                        if (staffInfo.clef !== undefined) {
                            staffInfo.clef = staffInfo.clef.replace(/[',]/g, "");
                            if (staffInfo.clef.indexOf('+16') !== -1) {
                                oct += 14;
                                staffInfo.clef = staffInfo.clef.replace('+16', '');
                            }
                            staffInfo.verticalPos = calcMiddle(staffInfo.clef, oct);
                        }
                        break;
                    case 'treble':
                    case 'bass':
                    case 'tenor':
                    case 'alto':
                    case 'perc':
                    case 'none':
                    case 'treble\'':
                    case 'bass\'':
                    case 'tenor\'':
                    case 'alto\'':
                    case 'none\'':
                    case 'treble\'\'':
                    case 'bass\'\'':
                    case 'tenor\'\'':
                    case 'alto\'\'':
                    case 'none\'\'':
                    case 'treble,':
                    case 'bass,':
                    case 'tenor,':
                    case 'alto,':
                    case 'none,':
                    case 'treble,,':
                    case 'bass,,':
                    case 'tenor,,':
                    case 'alto,,':
                    case 'none,,':
                    case 'treble+8':
                    case 'treble-8':
                    case 'treble^8':
                    case 'treble_8':
                    case 'treble1':
                    case 'treble2':
                    case 'treble3':
                    case 'treble4':
                    case 'treble5':
                    case 'bass+8':
                    case 'bass-8':
                    case 'bass^8':
                    case 'bass_8':
                    case 'bass+16':
                    case 'bass-16':
                    case 'bass^16':
                    case 'bass_16':
                    case 'bass1':
                    case 'bass2':
                    case 'bass3':
                    case 'bass4':
                    case 'bass5':
                    case 'tenor1':
                    case 'tenor2':
                    case 'tenor3':
                    case 'tenor4':
                    case 'tenor5':
                    case 'alto1':
                    case 'alto2':
                    case 'alto3':
                    case 'alto4':
                    case 'alto5':
                    case 'alto+8':
                    case 'alto-8':
                    case 'alto^8':
                    case 'alto_8':
                        let oct2 = 0;
                        staffInfo.clef = token.token.replace(/[',]/g, "");
                        staffInfo.verticalPos = calcMiddle(staffInfo.clef, oct2);
                        multilineVars.voices[id].clef = token.token;
                        break;
                    case 'staves':
                    case 'stave':
                    case 'stv':
                        addNextTokenToStaffInfo('staves');
                        break;
                    case 'brace':
                    case 'brc':
                        addNextTokenToStaffInfo('brace');
                        break;
                    case 'bracket':
                    case 'brk':
                        addNextTokenToStaffInfo('bracket');
                        break;
                    case 'name':
                    case 'nm':
                        addNextTokenToStaffInfo('name');
                        break;
                    case 'subname':
                    case 'sname':
                    case 'snm':
                        addNextTokenToStaffInfo('subname');
                        break;
                    case 'merge':
                        staffInfo.startStaff = false;
                        break;
                    case 'stem':
                    case 'stems':
                        attr = tokenizer.getVoiceToken(line, start, end);
                        if (attr.warn !== undefined)
                            warn("Expected value for stems in voice: " + attr.warn, line, start);
                        else if (attr.err !== undefined)
                            warn("Expected value for stems in voice: " + attr.err, line, start);
                        else if (attr.token === 'up' || attr.token === 'down')
                            multilineVars.voices[id].stem = attr.token;
                        else
                            warn("Expected up or down for voice stem", line, start);
                        start += attr.len;
                        break;
                    case 'up':
                    case 'down':
                        multilineVars.voices[id].stem = token.token;
                        break;
                    case 'middle':
                    case 'm':
                        addNextTokenToStaffInfo('verticalPos');
                        staffInfo.verticalPos = parseMiddle(staffInfo.verticalPos).mid;
                        break;
                    case 'gchords':
                    case 'gch':
                        multilineVars.voices[id].suppressChords = true;
                        attr = tokenizer.getVoiceToken(line, start, end);
                        if (attr.token === "0")
                            start = start + attr.len;
                        break;
                    case 'space':
                    case 'spc':
                        addNextTokenToStaffInfo('spacing');
                        break;
                    case 'scale':
                        addNextTokenToVoiceInfo(id, 'scale', 'number');
                        break;
                    case 'score':
                        addNextNoteTokenToVoiceInfo(id, 'scoreTranspose');
                        break;
                    case 'transpose':
                        addNextTokenToVoiceInfo(id, 'transpose', 'number');
                        break;
                    case 'stafflines':
                        addNextTokenToVoiceInfo(id, 'stafflines', 'number');
                        break;
                    case 'staffscale':
                        addNextTokenToVoiceInfo(id, 'staffscale', 'number');
                        break;
                    case 'octave':
                        addNextTokenToVoiceInfo(id, 'octave', 'number');
                        break;
                    case 'volume':
                        addNextTokenToVoiceInfo(id, 'volume', 'number');
                        break;
                    case 'cue':
                        const cue = getNextToken('cue', 'string');
                        if (cue === 'on')
                            multilineVars.voices[id].scale = 0.6;
                        else
                            multilineVars.voices[id].scale = 1;
                        break;
                    case "style":
                        attr = tokenizer.getVoiceToken(line, start, end);
                        if (attr.warn !== undefined)
                            warn("Expected value for style in voice: " + attr.warn, line, start);
                        else if (attr.err !== undefined)
                            warn("Expected value for style in voice: " + attr.err, line, start);
                        else if (attr.token === 'normal' || attr.token === 'harmonic' || attr.token === 'rhythm' || attr.token === 'x' || attr.token === 'triangle')
                            multilineVars.voices[id].style = attr.token;
                        else
                            warn("Expected one of [normal, harmonic, rhythm, x, triangle] for voice style", line, start);
                        start += attr.len;
                        break;
                }
            }
            start += tokenizer.eatWhiteSpace(line, start);
        }
        if (multilineVars.staves) {
            for (let i = 0; i < multilineVars.staves.length; i++) {
                if (staffInfo.startStaff) {
                    multilineVars.staves[i].voices = [];
                }
            }
        }
        if (staffInfo.name)
            multilineVars.voices[id].name = staffInfo.name;
        if (staffInfo.subname)
            multilineVars.voices[id].subname = staffInfo.subname;
        const currentVoice = multilineVars.voices[id];
        if (currentVoice) {
            if (currentVoice.index === undefined) {
                if (!multilineVars.staves)
                    multilineVars.staves = [];
                if (staffInfo.startStaff)
                    multilineVars.staves.push({ voices: [id] });
                else
                    multilineVars.staves[multilineVars.staves.length - 1].voices.push(id);
                const staffNum = multilineVars.staves.length - 1;
                const voiceNum = multilineVars.staves[staffNum].voices.length - 1;
                multilineVars.voices[id].staffNum = staffNum;
                multilineVars.voices[id].index = voiceNum;
                let clef2;
                if (multilineVars.voices[id].clef)
                    clef2 = { type: multilineVars.voices[id].clef, verticalPos: staffInfo.verticalPos };
                else
                    clef2 = { type: 'treble', verticalPos: 4 };
                if (staffInfo.verticalPos)
                    clef2.verticalPos = staffInfo.verticalPos;
                if (staffInfo.bracket)
                    multilineVars.staves[staffNum].bracket = staffInfo.bracket;
                if (staffInfo.brace)
                    multilineVars.staves[staffNum].brace = staffInfo.brace;
                if (staffNum > 0 || voiceNum > 0)
                    tuneBuilder.startNewLine({
                        clef: clef2, name: staffInfo.name, subname: staffInfo.subname,
                        style: multilineVars.voices[id].style,
                        stem: multilineVars.voices[id].stem,
                        scale: multilineVars.voices[id].scale,
                        part: multilineVars.partForNextLine,
                        currentVoiceName: id
                    });
                else {
                    clef2.stafflines = staffInfo.stafflines;
                    clef2.staffscale = staffInfo.staffscale;
                    tuneBuilder.appendStartingElement('clef', multilineVars.iChar + 2, multilineVars.iChar + line.length, clef2);
                }
                multilineVars.staves[staffNum].clef = clef2;
                if (multilineVars.partForNextLine)
                    delete multilineVars.partForNextLine;
                let retNewLine = false;
                if (staffNum > 0 || voiceNum > 0) {
                    retNewLine = true;
                }
                if (multilineVars.currentVoice) {
                    if (multilineVars.currentVoice.index === currentVoice.index && multilineVars.currentVoice.staffNum === currentVoice.staffNum)
                        return retNewLine;
                }
                multilineVars.currentVoice = currentVoice;
                tuneBuilder.setCurrentVoice(currentVoice.staffNum, currentVoice.index, id);
                return retNewLine;
            }
            else {
                if (multilineVars.currentVoice) {
                    if (multilineVars.currentVoice.index === currentVoice.index && multilineVars.currentVoice.staffNum === currentVoice.staffNum)
                        return false;
                }
                multilineVars.currentVoice = currentVoice;
                tuneBuilder.setCurrentVoice(currentVoice.staffNum, currentVoice.index, id);
                return false;
            }
        }
        else {
            return false;
        }
    }
};
export default parseKeyVoice;
