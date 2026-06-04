import ChordTrack from "./chord-track";
import pitchesToPerc from "./pitches-to-perc";
export class MidiFlattener {
    constructor() {
        this.barAccidentals = [];
        this.accidentals = [0, 0, 0, 0, 0, 0, 0];
        this.midiTranspose = 0;
        this.bagpipes = false;
        this.tracks = [];
        this.tempoChangeFactor = 1;
        this.currentTrack = [];
        this.lastNoteDurationPosition = -1;
        this.lastEventTime = 0;
        this.meter = { num: 4, den: 4 };
        this.drumInstrument = 128;
        this.lastBarTime = 0;
        this.doBeatAccents = true;
        this.stressBeat1 = 105;
        this.stressBeatDown = 95;
        this.stressBeatUp = 85;
        this.volumesPerNotePitch = [];
        this.beatFraction = 0.25;
        this.slurCount = 0;
        this.drumTrack = [];
        this.drumTrackFinished = false;
        this.drumDefinition = {};
        this.drumBars = 1;
        this.pickupLength = 0;
        this.normalBreakBetweenNotes = 0;
        this.slurredBreakBetweenNotes = -0.001;
        this.staccatoBreakBetweenNotes = 0.4;
        this.scale = [0, 2, 4, 5, 7, 9, 11];
    }
    flatten(voices, options, percmap_, midiOptions) {
        if (!options)
            options = {};
        if (!midiOptions)
            midiOptions = {};
        this.barAccidentals = [];
        this.accidentals = [0, 0, 0, 0, 0, 0, 0];
        this.bagpipes = false;
        this.tracks = [];
        this.startingTempo = options.qpm;
        this.startingMeter = undefined;
        this.tempoChangeFactor = 1;
        this.instrument = undefined;
        this.currentInstrument = undefined;
        this.currentTrack = [];
        this.currentTrackName = undefined;
        this.lastEventTime = 0;
        this.percmap = percmap_;
        this.meter = { num: 4, den: 4 };
        this.doBeatAccents = true;
        this.stressBeat1 = 105;
        this.stressBeatDown = 95;
        this.stressBeatUp = 85;
        this.volumesPerNotePitch = [];
        this.beatFraction = 0.25;
        this.nextVolume = undefined;
        this.nextVolumeDelta = undefined;
        this.slurCount = 0;
        this.drumTrack = [];
        this.drumTrackFinished = false;
        this.drumDefinition = {};
        this.drumBars = 1;
        if (voices.length > 0 && voices[0].length > 0)
            this.pickupLength = voices[0][0].pickupLength;
        if (options.bassprog !== undefined && !midiOptions.bassprog)
            midiOptions.bassprog = [options.bassprog];
        if (options.bassvol !== undefined && !midiOptions.bassvol)
            midiOptions.bassvol = [options.bassvol];
        if (options.chordprog !== undefined && !midiOptions.chordprog)
            midiOptions.chordprog = [options.chordprog];
        if (options.chordvol !== undefined && !midiOptions.chordvol)
            midiOptions.chordvol = [options.chordvol];
        if (options.gchord !== undefined && !midiOptions.gchord)
            midiOptions.gchord = [options.gchord];
        this.chordTrack = new ChordTrack(voices.length, options.chordsOff, midiOptions, this.meter);
        this.preProcess(voices, options);
        for (var i = 0; i < voices.length; i++) {
            this.midiTranspose = 0;
            this.chordTrack.setTranspose(this.midiTranspose);
            this.lastNoteDurationPosition = -1;
            const voice = voices[i];
            this.currentTrack = [{ cmd: 'program', channel: i, instrument: this.instrument }];
            this.currentTrackName = undefined;
            this.lastBarTime = 0;
            this.chordTrack.setLastBarTime(0);
            let voiceOff = false;
            if (options.voicesOff === true)
                voiceOff = true;
            else if (options.voicesOff && options.voicesOff.length && options.voicesOff.indexOf(i) >= 0)
                voiceOff = true;
            for (var j = 0; j < voice.length; j++) {
                const element = voice[j];
                switch (element.el_type) {
                    case "name":
                        this.currentTrackName = { cmd: 'text', type: "name", text: element.trackName };
                        break;
                    case "note":
                        this.writeNote(element, voiceOff);
                        break;
                    case "key":
                        this.accidentals = this.setKeySignature(element);
                        break;
                    case "meter":
                        if (!this.startingMeter)
                            this.startingMeter = element;
                        this.meter = element;
                        this.chordTrack.setMeter(this.meter);
                        this.beatFraction = this.getBeatFraction(this.meter);
                        this.alignDrumToMeter();
                        break;
                    case "tempo":
                        if (!this.startingTempo)
                            this.startingTempo = element.qpm;
                        else
                            this.tempoChangeFactor = element.qpm ? this.startingTempo / element.qpm : 1;
                        this.chordTrack.setTempoChangeFactor(this.tempoChangeFactor);
                        break;
                    case "transpose":
                        this.midiTranspose = element.transpose;
                        this.chordTrack.setTranspose(this.midiTranspose);
                        break;
                    case "bar":
                        this.chordTrack.barEnd(element);
                        this.barAccidentals = [];
                        if (i === 0)
                            this.writeDrum(voices.length + 1);
                        this.chordTrack.setRhythmHead(false, element);
                        this.lastBarTime = this.timeToRealTime(element.time);
                        this.chordTrack.setLastBarTime(this.lastBarTime);
                        break;
                    case "bagpipes":
                        this.bagpipes = true;
                        break;
                    case "instrument":
                        if (this.instrument === undefined)
                            this.instrument = element.program;
                        this.currentInstrument = element.program;
                        if (this.currentTrack.length > 0 && this.currentTrack[this.currentTrack.length - 1].cmd === 'program')
                            this.currentTrack[this.currentTrack.length - 1].instrument = element.program;
                        else {
                            let ii;
                            for (ii = this.currentTrack.length - 1; ii >= 0 && this.currentTrack[ii].cmd !== 'program'; ii--)
                                ;
                            if (ii < 0 || this.currentTrack[ii].instrument !== element.program)
                                this.currentTrack.push({ cmd: 'program', channel: 0, instrument: element.program });
                        }
                        break;
                    case "channel":
                        this.setChannel(element.channel);
                        break;
                    case "drum":
                        this.drumDefinition = this.normalizeDrumDefinition(element.params);
                        this.alignDrumToMeter();
                        break;
                    case "gchordOn":
                        this.chordTrack.gChordOn(element);
                        break;
                    case "beat":
                        this.stressBeat1 = element.beats[0];
                        this.stressBeatDown = element.beats[1];
                        this.stressBeatUp = element.beats[2];
                        if (!element.volumesPerNotePitch)
                            this.volumesPerNotePitch = [];
                        else
                            this.volumesPerNotePitch = element.volumesPerNotePitch;
                        break;
                    case "vol":
                        this.nextVolume = element.volume;
                        break;
                    case "volinc":
                        this.nextVolumeDelta = element.volume;
                        break;
                    case "beataccents":
                        this.doBeatAccents = element.value;
                        break;
                    case "gchord":
                    case "bassprog":
                    case "chordprog":
                    case "bassvol":
                    case "chordvol":
                    case "gchordbars":
                        this.chordTrack.paramChange(element);
                        break;
                    default:
                        console.log("MIDI creation. Unknown el_type: " + element.el_type + "\\n");
                        break;
                }
            }
            if (this.currentTrack[0].instrument === undefined)
                this.currentTrack[0].instrument = this.instrument ? this.instrument : 0;
            if (this.currentTrackName)
                this.currentTrack.unshift(this.currentTrackName);
            this.tracks.push(this.currentTrack);
            this.chordTrack.finish();
            if (this.drumTrack.length > 0)
                this.drumTrackFinished = true;
        }
        if (options.detuneOctave)
            this.findOctaves(this.tracks, parseInt(options.detuneOctave, 10));
        this.chordTrack.addTrack(this.tracks);
        if (this.drumTrack.length > 0)
            this.tracks.push(this.drumTrack);
        return { tempo: this.startingTempo, instrument: this.instrument, tracks: this.tracks, totalDuration: this.lastEventTime };
    }
    setChannel(channel) {
        for (var i = this.currentTrack.length - 1; i >= 0; i--) {
            if (this.currentTrack[i].cmd === "program") {
                this.currentTrack[i].channel = channel;
                return;
            }
        }
    }
    timeToRealTime(time) {
        return time / 1000000;
    }
    durationRounded(duration) {
        return Math.round(duration * this.tempoChangeFactor * 1000000) / 1000000;
    }
    preProcess(voices, options) {
        for (var i = 0; i < voices.length; i++) {
            var voice = voices[i];
            var ties = {};
            var startingTempo = options.qpm;
            var timeCounter = 0;
            var tempoMultiplier = 1;
            for (var j = 0; j < voice.length; j++) {
                var element = voice[j];
                if (element.el_type === 'tempo') {
                    if (!startingTempo)
                        startingTempo = element.qpm;
                    else
                        tempoMultiplier = element.qpm ? startingTempo / element.qpm : 1;
                    continue;
                }
                element.time = timeCounter;
                var thisDuration = element.duration ? element.duration : 0;
                timeCounter += Math.round(thisDuration * tempoMultiplier * 1000000);
                if (element.pitches) {
                    for (var k = 0; k < element.pitches.length; k++) {
                        var pitch = element.pitches[k];
                        if (pitch) {
                            pitch.duration = element.duration;
                            if (pitch.startTie) {
                                if (ties[pitch.pitch] === undefined)
                                    ties[pitch.pitch] = { el: j, pitch: k };
                                else {
                                    voice[ties[pitch.pitch].el].pitches[ties[pitch.pitch].pitch].duration += pitch.duration;
                                    element.pitches[k] = null;
                                }
                            }
                            else if (pitch.endTie) {
                                var tie = ties[pitch.pitch];
                                if (tie) {
                                    var dur = pitch.duration;
                                    delete voice[tie.el].pitches[tie.pitch].startTie;
                                    voice[tie.el].pitches[tie.pitch].duration += dur;
                                    element.pitches[k] = null;
                                    delete ties[pitch.pitch];
                                }
                                else {
                                    delete pitch.endTie;
                                }
                            }
                        }
                    }
                    delete element.duration;
                }
            }
            for (var key in ties) {
                if (ties.hasOwnProperty(key)) {
                    var item = ties[key];
                    delete voice[item.el].pitches[item.pitch].startTie;
                }
            }
        }
    }
    getBeatFraction(meter) {
        const den = parseInt(meter.den, 10);
        switch (den) {
            case 2: return 0.5;
            case 4: return 0.25;
            case 8:
                if (meter.num % 3 === 0)
                    return 0.375;
                else
                    return 0.125;
            case 16: return 0.125;
        }
        return 0.25;
    }
    calcBeat(measureStart, beatLength, currTime) {
        var distanceFromStart = currTime - measureStart;
        return distanceFromStart / beatLength;
    }
    processVolume(beat, voiceOff, pitchIndexOfNote) {
        if (voiceOff)
            return 0;
        let pitchStressBeat1 = this.stressBeat1;
        let pitchStressBeatDown = this.stressBeatDown;
        let pitchStressBeatUp = this.stressBeatUp;
        if (pitchIndexOfNote !== undefined && this.volumesPerNotePitch.length >= pitchIndexOfNote + 1) {
            pitchStressBeat1 = this.volumesPerNotePitch[pitchIndexOfNote][0];
            pitchStressBeatDown = this.volumesPerNotePitch[pitchIndexOfNote][1];
            pitchStressBeatUp = this.volumesPerNotePitch[pitchIndexOfNote][2];
        }
        var volume;
        if (this.nextVolume !== undefined) {
            volume = this.nextVolume;
            this.nextVolume = undefined;
        }
        else if (!this.doBeatAccents) {
            volume = pitchStressBeatDown;
        }
        else if (this.pickupLength > beat) {
            volume = pitchStressBeatUp;
        }
        else {
            var barBeat = this.calcBeat(this.lastBarTime, this.getBeatFraction(this.meter), beat);
            if (barBeat === 0)
                volume = pitchStressBeat1;
            else if (parseInt(barBeat, 10) === barBeat)
                volume = pitchStressBeatDown;
            else
                volume = pitchStressBeatUp;
        }
        if (this.nextVolumeDelta) {
            volume += this.nextVolumeDelta;
            this.nextVolumeDelta = undefined;
        }
        if (volume < 0)
            volume = 0;
        if (volume > 127)
            volume = 127;
        return voiceOff ? 0 : volume;
    }
    findNoteModifications(elem, velocity) {
        var ret = {};
        if (elem.decoration) {
            for (var d = 0; d < elem.decoration.length; d++) {
                if (elem.decoration[d] === 'staccato')
                    ret.thisBreakBetweenNotes = 'staccato';
                else if (elem.decoration[d] === 'tenuto')
                    ret.thisBreakBetweenNotes = 'tenuto';
                else if (elem.decoration[d] === 'accent')
                    ret.velocity = Math.min(127, velocity * 1.5);
                else if (elem.decoration[d] === 'trill')
                    ret.noteModification = "trill";
                else if (elem.decoration[d] === 'lowermordent')
                    ret.noteModification = "lowermordent";
                else if (elem.decoration[d] === 'uppermordent')
                    ret.noteModification = "pralltriller";
                else if (elem.decoration[d] === 'mordent')
                    ret.noteModification = "mordent";
                else if (elem.decoration[d] === 'turn')
                    ret.noteModification = "turn";
                else if (elem.decoration[d] === 'roll')
                    ret.noteModification = "roll";
                else if (elem.decoration[d] === 'pralltriller')
                    ret.noteModification = "pralltriller";
                else if (elem.decoration[d] === 'trillh')
                    ret.noteModification = "trillh";
            }
        }
        return ret;
    }
    doModifiedNotes(noteModification, p) {
        var start = p.start;
        var runningDuration = p.duration;
        var shortestNote = this.durationRounded(1.0 / 32);
        switch (noteModification) {
            case "trill":
                var note = 2;
                while (runningDuration > 0) {
                    this.currentTrack.push({ cmd: 'note', pitch: p.pitch + note, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                    note = (note === 2) ? 0 : 2;
                    runningDuration -= shortestNote;
                    start += shortestNote;
                }
                break;
            case "trillh":
                var noteh = 1;
                while (runningDuration > 0) {
                    this.currentTrack.push({
                        cmd: 'note',
                        pitch: p.pitch + noteh,
                        volume: p.volume,
                        start: start,
                        duration: shortestNote,
                        gap: 0,
                        instrument: this.currentInstrument,
                        style: 'decoration'
                    });
                    noteh = noteh === 1 ? 0 : 1;
                    runningDuration -= shortestNote;
                    start += shortestNote;
                }
                break;
            case "pralltriller":
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                runningDuration -= shortestNote;
                start += shortestNote;
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch + 2, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                runningDuration -= shortestNote;
                start += shortestNote;
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: runningDuration, gap: 0, instrument: this.currentInstrument });
                break;
            case "mordent":
            case "lowermordent":
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                runningDuration -= shortestNote;
                start += shortestNote;
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch - 2, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                runningDuration -= shortestNote;
                start += shortestNote;
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: runningDuration, gap: 0, instrument: this.currentInstrument });
                break;
            case "turn":
                shortestNote = p.duration / 4;
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch + 2, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start + shortestNote, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch - 1, volume: p.volume, start: start + shortestNote * 2, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                this.currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start + shortestNote * 3, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                break;
            case "roll":
                while (runningDuration > 0) {
                    this.currentTrack.push({ cmd: 'note', pitch: p.pitch, volume: p.volume, start: start, duration: shortestNote, gap: 0, instrument: this.currentInstrument, style: 'decoration' });
                    runningDuration -= shortestNote * 2;
                    start += shortestNote * 2;
                }
                break;
        }
    }
    writeNote(elem, voiceOff) {
        var velocity = this.processVolume(this.timeToRealTime(elem.time), voiceOff);
        this.chordTrack.processChord(elem);
        var graces;
        if (elem.gracenotes && elem.pitches && elem.pitches.length > 0 && elem.pitches[0]) {
            graces = this.processGraceNotes(elem.gracenotes, elem.pitches[0].duration);
            if (elem.elem)
                elem.elem.midiGraceNotePitches = this.writeGraceNotes(graces, this.timeToRealTime(elem.time), velocity * 2 / 3, this.currentInstrument);
        }
        if (elem.elem) {
            var rt = this.timeToRealTime(elem.time);
            var ms = rt / this.beatFraction / this.startingTempo * 60 * 1000;
            if (elem.elem.currentTrackMilliseconds === undefined) {
                elem.elem.currentTrackMilliseconds = ms;
                elem.elem.currentTrackWholeNotes = rt;
            }
            else {
                if (typeof elem.elem.currentTrackMilliseconds === 'number') {
                    if (elem.elem.currentTrackMilliseconds !== ms) {
                        elem.elem.currentTrackMilliseconds = [elem.elem.currentTrackMilliseconds, ms];
                        elem.elem.currentTrackWholeNotes = [elem.elem.currentTrackWholeNotes, rt];
                    }
                }
                else {
                    var found = false;
                    for (var j = 0; j < elem.elem.currentTrackMilliseconds.length; j++) {
                        if (elem.elem.currentTrackMilliseconds[j] === ms)
                            found = true;
                    }
                    if (!found) {
                        elem.elem.currentTrackMilliseconds.push(ms);
                        elem.elem.currentTrackWholeNotes.push(rt);
                    }
                }
            }
        }
        if (elem.pitches) {
            var thisBreakBetweenNotes = '';
            var ret = this.findNoteModifications(elem, velocity);
            if (ret.thisBreakBetweenNotes)
                thisBreakBetweenNotes = ret.thisBreakBetweenNotes;
            if (ret.velocity)
                velocity = ret.velocity;
            var ePitches = elem.pitches;
            if (elem.style === "rhythm") {
                ePitches = this.chordTrack.setRhythmHead(true, elem);
            }
            if (elem.elem)
                elem.elem.midiPitches = [];
            for (var i = 0; i < ePitches.length; i++) {
                let pitchVelocity = velocity;
                if (!ret.velocity && Array.isArray(elem.decoration) && elem.decoration.length > i) {
                    pitchVelocity = this.processVolume(this.timeToRealTime(elem.time), voiceOff, i);
                }
                var note = ePitches[i];
                if (!note)
                    continue;
                if (note.startSlur)
                    this.slurCount += note.startSlur.length;
                if (note.endSlur)
                    this.slurCount -= note.endSlur.length;
                var actualPitch = note.actualPitch ? note.actualPitch : this.adjustPitch(note);
                if (this.currentInstrument === this.drumInstrument && this.percmap) {
                    var name = pitchesToPerc(note);
                    if (name && this.percmap[name])
                        actualPitch = this.percmap[name].sound;
                }
                var p = { cmd: 'note', pitch: actualPitch, volume: pitchVelocity, start: this.timeToRealTime(elem.time), duration: this.durationRounded(note.duration), instrument: this.currentInstrument, startChar: elem.elem.startChar, endChar: elem.elem.endChar };
                p = this.adjustForMicroTone(p);
                if (elem.gracenotes) {
                    p.duration = p.duration / 2;
                    p.start = p.start + p.duration;
                }
                if (elem.elem)
                    elem.elem.midiPitches.push(p);
                if (ret.noteModification) {
                    this.doModifiedNotes(ret.noteModification, p);
                }
                else {
                    if (this.slurCount > 0)
                        p.endType = 'tenuto';
                    else if (thisBreakBetweenNotes)
                        p.endType = thisBreakBetweenNotes;
                    switch (p.endType) {
                        case "tenuto":
                            p.gap = this.slurredBreakBetweenNotes;
                            break;
                        case "staccato":
                            var d = p.duration * this.staccatoBreakBetweenNotes;
                            p.gap = this.startingTempo / 60 * d;
                            break;
                        default:
                            p.gap = this.normalBreakBetweenNotes;
                            break;
                    }
                    this.currentTrack.push(p);
                }
            }
            this.lastNoteDurationPosition = this.currentTrack.length - 1;
        }
        var realDur = this.getRealDuration(elem);
        this.lastEventTime = Math.max(this.lastEventTime, this.timeToRealTime(elem.time) + this.durationRounded(realDur));
    }
    getRealDuration(elem) {
        if (elem.pitches && elem.pitches.length > 0 && elem.pitches[0])
            return elem.pitches[0].duration;
        if (elem.elem)
            return elem.elem.duration;
        return elem.duration;
    }
    adjustPitch(note) {
        if (note.midipitch !== undefined)
            return note.midipitch;
        var pitch = note.pitch;
        if (note.accidental) {
            switch (note.accidental) {
                case "sharp":
                    this.barAccidentals[pitch] = 1;
                    break;
                case "flat":
                    this.barAccidentals[pitch] = -1;
                    break;
                case "natural":
                    this.barAccidentals[pitch] = 0;
                    break;
                case "dblsharp":
                    this.barAccidentals[pitch] = 2;
                    break;
                case "dblflat":
                    this.barAccidentals[pitch] = -2;
                    break;
                case "quartersharp":
                    this.barAccidentals[pitch] = 0.25;
                    break;
                case "quarterflat":
                    this.barAccidentals[pitch] = -0.25;
                    break;
            }
        }
        var actualPitch = this.extractOctave(pitch) * 12 + this.scale[this.extractNote(pitch)] + 60;
        if (this.barAccidentals[pitch] !== undefined) {
            actualPitch += this.barAccidentals[pitch];
        }
        else {
            actualPitch += this.accidentals[this.extractNote(pitch)];
        }
        actualPitch += this.midiTranspose;
        return actualPitch;
    }
    setKeySignature(elem) {
        var accidentals = [0, 0, 0, 0, 0, 0, 0];
        if (!elem.accidentals)
            return accidentals;
        for (var i = 0; i < elem.accidentals.length; i++) {
            var acc = elem.accidentals[i];
            var d;
            switch (acc.acc) {
                case "flat":
                    d = -1;
                    break;
                case "quarterflat":
                    d = -0.25;
                    break;
                case "sharp":
                    d = 1;
                    break;
                case "quartersharp":
                    d = 0.25;
                    break;
                default:
                    d = 0;
                    break;
            }
            var lowercase = acc.note.toLowerCase();
            var note = this.extractNote(lowercase.charCodeAt(0) - 'c'.charCodeAt(0));
            accidentals[note] += d;
        }
        return accidentals;
    }
    processGraceNotes(graces, companionDuration) {
        var graceDuration = 0;
        var ret = [];
        var grace;
        for (var g = 0; g < graces.length; g++) {
            grace = graces[g];
            graceDuration += grace.duration;
        }
        var multiplier = companionDuration / 2 / graceDuration;
        for (g = 0; g < graces.length; g++) {
            grace = graces[g];
            var actualPitch = this.adjustPitch(grace);
            if (this.currentInstrument === this.drumInstrument && this.percmap) {
                var name = pitchesToPerc(grace);
                if (name && this.percmap[name])
                    actualPitch = this.percmap[name].sound;
            }
            var pitch = { pitch: actualPitch, duration: grace.duration * multiplier };
            pitch = this.adjustForMicroTone(pitch);
            ret.push(pitch);
        }
        return ret;
    }
    writeGraceNotes(graces, start, velocity, currentInstrument) {
        var midiGrace = [];
        velocity = Math.round(velocity);
        for (var g = 0; g < graces.length; g++) {
            var gp = graces[g];
            this.currentTrack.push({ cmd: 'note', pitch: gp.pitch, volume: velocity, start: start, duration: gp.duration, gap: 0, instrument: currentInstrument, style: 'grace' });
            midiGrace.push({
                pitch: gp.pitch,
                durationInMeasures: gp.duration,
                volume: velocity,
                instrument: currentInstrument
            });
            start += gp.duration;
        }
        return midiGrace;
    }
    adjustForMicroTone(description) {
        var pitch = '' + description.pitch;
        if (pitch.indexOf(".75") >= 0) {
            description.pitch = Math.round(description.pitch);
            description.cents = -50;
        }
        else if (pitch.indexOf(".25") >= 0) {
            description.pitch = Math.round(description.pitch);
            description.cents = 50;
        }
        return description;
    }
    extractOctave(pitch) {
        return Math.floor(pitch / 7);
    }
    extractNote(pitch) {
        pitch = pitch % 7;
        if (pitch < 0)
            pitch += 7;
        return pitch;
    }
    normalizeDrumDefinition(params) {
        if (params.pattern.length === 0 || params.on === false)
            return { on: false };
        var str = params.pattern[0];
        var events = [];
        var event = "";
        var totalPlay = 0;
        for (var i = 0; i < str.length; i++) {
            if (str[i] === 'd')
                totalPlay++;
            if (str[i] === 'd' || str[i] === 'z') {
                if (event.length !== 0) {
                    events.push(event);
                    event = str[i];
                }
                else
                    event = event + str[i];
            }
            else {
                if (event.length === 0) {
                    return { on: false };
                }
                event = event + str[i];
            }
        }
        if (event.length !== 0)
            events.push(event);
        if (params.pattern.length !== totalPlay * 2 + 1)
            return { on: false };
        var ret = { on: true, bars: params.bars, pattern: [] };
        var beatLength = this.getBeatFraction(this.meter);
        var playCount = 0;
        for (var j = 0; j < events.length; j++) {
            event = events[j];
            var len = 1;
            var div = false;
            var num = 0;
            for (var k = 1; k < event.length; k++) {
                switch (event[k]) {
                    case "/":
                        if (num !== 0)
                            len *= num;
                        num = 0;
                        div = true;
                        break;
                    case "1":
                    case "2":
                    case "3":
                    case "4":
                    case "5":
                    case "6":
                    case "7":
                    case "8":
                    case "9":
                    case "0":
                        num = num * 10 + parseInt(event[k], 10);
                        break;
                    default:
                        return { on: false };
                }
            }
            if (div) {
                if (num === 0)
                    num = 2;
                len /= num;
            }
            else if (num)
                len *= num;
            if (event[0] === 'd') {
                ret.pattern.push({ len: len * beatLength, pitch: params.pattern[1 + playCount], velocity: params.pattern[1 + playCount + totalPlay] });
                playCount++;
            }
            else
                ret.pattern.push({ len: len * beatLength, pitch: null });
        }
        this.drumBars = params.bars ? params.bars : 1;
        return ret;
    }
    alignDrumToMeter() {
        if (!this.drumDefinition || !this.drumDefinition.pattern) {
            return;
        }
        var ret = this.drumDefinition;
        var totalTime = 0;
        var measuresPerBeat = this.meter.num / this.meter.den;
        for (var ii = 0; ii < ret.pattern.length; ii++)
            totalTime += ret.pattern[ii].len;
        var factor = totalTime / this.drumBars / measuresPerBeat;
        for (ii = 0; ii < ret.pattern.length; ii++)
            ret.pattern[ii].len = ret.pattern[ii].len / factor;
        this.drumDefinition = ret;
    }
    writeDrum(channel) {
        if (this.drumTrack.length === 0 && !this.drumDefinition.on)
            return;
        var measureLen = this.meter.num / this.meter.den;
        if (this.drumTrack.length === 0) {
            if (this.lastEventTime < measureLen)
                return;
            this.drumTrack.push({ cmd: 'program', channel: channel, instrument: this.drumInstrument });
        }
        if (!this.drumDefinition.on) {
            return;
        }
        var start = this.lastBarTime;
        for (var i = 0; i < this.drumDefinition.pattern.length; i++) {
            var len = this.durationRounded(this.drumDefinition.pattern[i].len);
            if (this.drumDefinition.pattern[i].pitch) {
                this.drumTrack.push({
                    cmd: 'note',
                    pitch: this.drumDefinition.pattern[i].pitch,
                    volume: this.drumDefinition.pattern[i].velocity,
                    start: start,
                    duration: len,
                    gap: 0,
                    instrument: this.drumInstrument
                });
            }
            start += len;
        }
    }
    findOctaves(tracks, detuneCents) {
        var timing = {};
        for (var i = 0; i < tracks.length; i++) {
            for (var j = 0; j < tracks[i].length; j++) {
                var note = tracks[i][j];
                if (note.cmd === "note") {
                    if (timing[note.start] === undefined)
                        timing[note.start] = [];
                    timing[note.start].push({ track: i, event: j, pitch: note.pitch });
                }
            }
        }
        var keys = Object.keys(timing);
        for (i = 0; i < keys.length; i++) {
            var arr = timing[keys[i]];
            if (arr.length > 1) {
                arr = arr.sort(function (a, b) {
                    return a.pitch - b.pitch;
                });
                var topEvent = arr[arr.length - 1];
                var topNote = topEvent.pitch % 12;
                var found = false;
                for (j = 0; !found && j < arr.length - 1; j++) {
                    if (arr[j].pitch % 12 === topNote)
                        found = true;
                }
                if (found) {
                    var event = tracks[topEvent.track][topEvent.event];
                    if (!event.cents)
                        event.cents = 0;
                    event.cents += detuneCents;
                }
            }
        }
    }
}
export default function flatten(voices, options, percmap_, midiOptions) {
    const flattener = new MidiFlattener();
    return flattener.flatten(voices, options, percmap_, midiOptions);
}
