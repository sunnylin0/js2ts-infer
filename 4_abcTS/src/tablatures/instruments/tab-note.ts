import { noteToMidi, midiToNote } from '../../synth/note-to-midi';
export default class TabNote {
    // 💡 1. 固定初始值的變數全部移到外面宣告
    pitchAltered = 0;
    isSharp = false;
    isKeySharp = false;
    isDouble = false;
    isAltered = false;
    isFlat = false;
    isKeyFlat = false;
    natural = null;
    quarter = null;
    acc = 0;

    // 這些是後面會動態賦值的屬性，在外面先宣告可以讓類別結構更清晰
    pitch;
    name;
    hasComma = 0;
    isQuoted = 0;
    isLower = false;
    courtesy = false;

    constructor(note, clefTranspose = 0) {
        // 💡 2. constructor 只留下需要動態計算的邏輯
        this.pitch = noteToMidi(note) + clefTranspose;

        let newNote = note;

        // 解析 ABC 記譜法的變音符號 (Accidentals)
        if (note.startsWith('_')) {
            this.isFlat = true;
            this.acc = -1;
            if (note[1] === '/') {
                this.isFlat = false;
                this.quarter = "v";
                this.acc = 0;
                newNote = note.slice(2);
            } else if (note[1] === '_') {
                this.isDouble = true;
                this.acc = -2;
                newNote = note.slice(2);
            } else {
                newNote = note.slice(1);
            }
        } else if (note.startsWith('^')) {
            this.isSharp = true;
            this.acc = 1;
            if (note[1] === '/') {
                this.isSharp = false;
                this.quarter = "^";
                this.acc = 0;
                newNote = note.slice(2);
            } else if (note[1] === '^') {
                this.isDouble = true;
                this.acc = 2;
                newNote = note.slice(2);
            } else {
                newNote = note.slice(1);
            }
        } else if (note.startsWith('=')) {
            this.natural = true;
            this.acc = 0;
            newNote = note.slice(1);
        }

        this.isAltered = this.isFlat || this.isSharp || (this.quarter != null);

        // 解析音高名稱與八度記號 (, 與 ')
        this.hasComma = (newNote.match(/,/g) || []).length;
        this.isQuoted = (newNote.match(/'/g) || []).length;

        // 移除八度記號，留下純音名
        const pureName = newNote.replace(/[',]/g, '');
        this.isLower = (pureName === pureName.toLowerCase());
        this.name = pureName[0].toUpperCase();

        // 禮貌記號 (Courtesy Accidental) 判斷
        this.courtesy = note === midiToNote(this.pitch);
    }

    clone(): TabNote {
        const newTabNote: TabNote = new TabNote(this.emit());
        Object.assign(newTabNote, {
            pitch: this.pitch,
            hasComma: this.hasComma,
            isLower: this.isLower,
            isQuoted: this.isQuoted,
            isSharp: this.isSharp,
            isKeySharp: this.isKeySharp,
            isFlat: this.isFlat,
            isKeyFlat: this.isKeyFlat
        });
        return newTabNote;
    }

    sameNoteAs(note: TabNote): boolean {
        return note.pitch === this.pitch;
    }

    isLowerThan(note: TabNote): boolean {
        return note.pitch > this.pitch;
    }
    checkKeyAccidentals(accidentals, measureAccidentals): void {
        if (this.isAltered || this.natural)
            return;
        const upperName = this.name.toUpperCase();
        // 優先處理小節內臨時記號
        if (measureAccidentals[upperName]) {
            const accKey = measureAccidentals[upperName]
            const accMapping = { "__": -2, "_": -1, "=": 0, "^": 1, "^^^": 2 };
            const alteredValue = accMapping[accKey] ?? 0;
            this.acc = alteredValue;
            this.pitchAltered = alteredValue;
            return;
        }
        else if (accidentals) {
            const target = accidentals.find(curAcc => upperName === curAcc.note.toUpperCase());
            if (target) {
                if (target.acc === 'flat') {
                    this.acc = -1;
                    this.isKeyFlat = true;
                    this.pitchAltered = -1;
                } else if (target.acc === 'sharp') {
                    this.acc = 1;
                    this.isKeySharp = true;
                    this.pitchAltered = 1;
                }
            }
        }
    }
    getAccidentalEquiv(): TabNote {
        let cloned: TabNote = this.clone();
        if (cloned.isSharp || cloned.isKeySharp) {
            cloned = cloned.nextNote();
            cloned.isFlat = true;
            cloned.isSharp = false;
            cloned.isKeySharp = false;
        }
        else if (cloned.isFlat || cloned.isKeyFlat) {
            cloned = cloned.prevNote();
            cloned.isSharp = true;
            cloned.isFlat = false;
            cloned.isKeyFlat = false;
        }
        return cloned;
    }
    nextNote(): TabNote {
        const note: string = midiToNote(this.pitch + 1 + this.pitchAltered);
        return new TabNote(note);
    }
    prevNote(): TabNote {
        const note: string = midiToNote(this.pitch - 1 + this.pitchAltered);
        return new TabNote(note);
    }
    // 抽取共用的純音名與八度後綴邏輯
    _getBaseNoteString(): string {
        let baseName = this.isLower ? this.name.toLowerCase() : this.name;
        return baseName + "'".repeat(this.isQuoted) + ",".repeat(this.hasComma);
    }

    emitNoAccidentals(): string {
        return this._getBaseNoteString();
    }



    /**
     * 還原成原始的 ABC 記譜法字串
     * @returns {string}
     */
    emit(): string {
        let prefix: string = '';

        if (this.quarter) {
            prefix = this.quarter === "^" ? "^/" : "_/";
        } else if (this.natural) {
            prefix = '=';
        } else if (this.isSharp || this.isKeySharp) {
            prefix = this.isDouble ? '^^' : '^';
        } else if (this.isFlat || this.isKeyFlat) {
            prefix = this.isDouble ? '__' : '_';
        }

        return prefix + this._getBaseNoteString();
    }
}
