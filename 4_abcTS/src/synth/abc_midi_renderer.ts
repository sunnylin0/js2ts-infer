import centsToFactor from "./cents-to-factor";
class Midi {
    instrument: any;
    trackstrings = "";
    trackcount = 0;
    noteOnAndChannel = "%90";
    noteOffAndChannel = "%80";
    track = "";
    trackName = "";
    trackInstrument = "";
    silencelength = 0;
    channel = 0;
    noteWarped = {};
    HALF_STEP = 4096;

    constructor() {
    }
    setTempo(qpm): void {
        if (this.trackcount === 0) {
            this.startTrack();
            this.track += "%00%FF%51%03" + this.toHex(Math.round(60000000 / qpm), 6);
            this.endTrack();
        }
    }
    setGlobalInfo(qpm, name, key, time): void {
        if (this.trackcount === 0) {
            this.startTrack();
            const divisions: number = Math.round(60000000 / qpm);
            this.track += "%00%FF%51%03" + this.toHex(divisions, 6);
            if (key)
                this.track += this.keySignature(key);
            if (time)
                this.track += this.timeSignature(time);
            if (name)
                this.track += this.encodeString(name, "%01");
            this.endTrack();
        }
    }
    startTrack(): void {
        this.noteWarped = {};
        this.track = "";
        this.trackName = "";
        this.trackInstrument = "";
        this.silencelength = 0;
        this.trackcount++;
        if (this.instrument !== undefined) {
            this.setInstrument(this.instrument);
        }
    }
    endTrack(): void {
        this.track = this.trackName + this.trackInstrument + this.track;
        const tracklength: string = this.toHex(this.track.length / 3 + 4, 8);
        this.track = "MTrk" + tracklength + this.track + '%00%FF%2F%00';
        this.trackstrings += this.track;
    }
    setText(type, text): void {
        switch (type) {
            case 'name':
                this.trackName = this.encodeString(text, "%03");
                break;
        }
    }
    setInstrument(number: number): void {
        this.trackInstrument = "%00%C0" + this.toHex(number, 2);
        this.instrument = number;
    }
    setChannel(number: number, pan: number): void {
        this.channel = number;
        const ccPrefix: string = "%00%B" + this.channel.toString(16);
        this.track += ccPrefix + "%79%00"; // Reset All Controllers
        this.track += ccPrefix + "%40%00"; // Damper pedal
        this.track += ccPrefix + "%5B%30"; // Effect 1 Depth (reverb)
        const panVal: number = pan !== undefined ? Math.round((pan + 1) * 64) : 64;
        this.track += ccPrefix + "%0A" + this.toHex(panVal, 2); // Pan
        this.track += ccPrefix + "%07%64"; // Channel Volume
        this.noteOnAndChannel = "%9" + this.channel.toString(16);
        this.noteOffAndChannel = "%8" + this.channel.toString(16);
    }
    startNote(pitch, loudness, cents): void {
        this.track += this.toDurationHex(this.silencelength);
        this.silencelength = 0;
        if (cents) {
            this.track += "%e" + this.channel.toString(16);
            const bend: number = Math.round(centsToFactor(cents) * this.HALF_STEP);
            this.track += this.to7BitHex(0x2000 + bend);
            this.track += this.toDurationHex(0);
            this.noteWarped[pitch] = true;
        }
        this.track += this.noteOnAndChannel;
        this.track += "%" + pitch.toString(16) + this.toHex(loudness, 2);
    }
    endNote(pitch): void {
        this.track += this.toDurationHex(this.silencelength);
        this.silencelength = 0;
        if (this.noteWarped[pitch]) {
            this.track += "%e" + this.channel.toString(16);
            this.track += this.to7BitHex(0x2000);
            this.track += this.toDurationHex(0);
            this.noteWarped[pitch] = false;
        }
        this.track += this.noteOffAndChannel;
        this.track += "%" + pitch.toString(16) + "%00";
    }
    addRest(length): void {
        this.silencelength += length;
        if (this.silencelength < 0)
            this.silencelength = 0;
    }
    getData(): string {
        return "data:audio/midi," +
            "MThd%00%00%00%06%00%01" + this.toHex(this.trackcount, 4) + "%01%e0" +
            this.trackstrings;
    }
    embed(parent, noplayer): void {
        const data: string = this.getData();
        const link: HTMLAnchorElement | HTMLEmbedElement = this.setAttributes(document.createElement('a'), { href: data });
        link.innerHTML = "download midi";
        parent.insertBefore(link, parent.firstChild);
        if (noplayer)
            return;
        const embed: HTMLAnchorElement | HTMLEmbedElement = this.setAttributes(document.createElement('embed'), {
            src: data,
            type: 'video/quicktime',
            controller: 'true',
            autoplay: 'false',
            loop: 'false',
            enablejavascript: 'true',
            style: 'display:block; height: 20px;'
        });
        parent.insertBefore(embed, parent.firstChild);
    }
    setAttributes(elm: HTMLAnchorElement | HTMLEmbedElement, attrs): HTMLAnchorElement | HTMLEmbedElement {
        for (const attr in attrs)
            elm.setAttribute(attr, attrs[attr]);
        return elm;
    }
    encodeString(str, cmdType: string): string {
        let nameArray: string = "";
        for (let i: number = 0; i < str.length; i++)
            nameArray += this.toHex(str.charCodeAt(i), 2);
        return "%00%FF" + cmdType + this.toHex(nameArray.length / 3, 2) + nameArray;
    }
    keySignature(key): string {
        if (!key || !key.accidentals)
            return "";
        const hex: string = "%00%FF%59%02";
        let sharpCount: number = 0;
        let flatCount: number = 256;
        for (let i: number = 0; i < key.accidentals.length; i++) {
            if (key.accidentals[i].acc === "sharp")
                sharpCount++;
            else if (key.accidentals[i].acc === "flat")
                flatCount--;
        }
        const sig: string = flatCount !== 256 ? this.toHex(flatCount, 2) : this.toHex(sharpCount, 2);
        const mode: string = (key.mode === "m") ? "%01" : "%00";
        return hex + sig + mode;
    }
    timeSignature(time): string {
        let hex: string = "%00%FF%58%04" + this.toHex(time.num, 2);
        const dens = { 1: 0, 2: 1, 4: 2, 8: 3, 16: 4, 32: 5 };
        const den = dens[time.den];
        if (den === undefined)
            return "";
        hex += this.toHex(den, 2);
        let clocks;
        switch (time.num + "/" + time.den) {
            case "2/4":
            case "3/4":
            case "4/4":
            case "5/4":
                clocks = 24;
                break;
            case "6/4":
                clocks = 72;
                break;
            case "2/2":
            case "3/2":
            case "4/2":
                clocks = 48;
                break;
            case "3/8":
            case "6/8":
            case "9/8":
            case "12/8":
                clocks = 36;
                break;
        }
        if (!clocks)
            return "";
        hex += this.toHex(clocks, 2);
        return hex + "%08";
    }
    toHex(n: number, padding: number): string {
        let s: string = Math.floor(n).toString(16);
        while (s.length < padding)
            s = "0" + s;
        if (s.length > padding)
            s = s.substring(0, padding);
        return this.encodeHex(s);
    }
    encodeHex(s: string): string {
        let ret: string = "";
        for (let i: number = 0; i < s.length; i += 2) {
            ret += "%";
            ret += s.substr(i, 2);
        }
        return ret;
    }
    to7BitHex(n: number): string {
        const val: number = Math.round(n);
        const lower: number = val % 128;
        const higher: number = val - lower;
        return this.toHex(higher * 2 + lower, 4);
    }
    toDurationHex(n: number): string {
        const a = [];
        let val: number = Math.round(n);
        if (val === 0)
            return "00";
        while (val !== 0) {
            a.push(val & 0x7F);
            val = val >> 7;
        }
        let res: number = 0;
        for (let i: number = a.length - 1; i >= 0; i--) {
            res = res << 8;
            let bits = a[i];
            if (i !== 0)
                bits = bits | 0x80;
            res = res | bits;
        }
        let s: string = res.toString(16);
        let padding: number = s.length;
        padding += padding % 2;
        return this.toHex(res, padding);
    }
}
const rendererFactory = function (): Midi {
    return new Midi();
};
export default rendererFactory;
