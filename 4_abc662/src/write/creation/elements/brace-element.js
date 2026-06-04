class BraceElem {
    constructor(voice, type) {
        this.startVoice = voice;
        this.type = type;
    }
    setBottomStaff(voice) {
        this.endVoice = voice;
        // If only the start brace has a name then the name belongs to the brace instead of the staff.
        if (this.startVoice.header && !this.endVoice.header) {
            this.header = this.startVoice.header;
            delete this.startVoice.header;
        }
    }
    continuing(voice) {
        // If the final staff isn't present, then use the last one we saw.
        this.lastContinuedVoice = voice;
    }
    getWidth() {
        return 10; // TODO-PER: right now the drawing function doesn't vary the width at all. If it does in the future then this will change.
    }
    isStartVoice(voice) {
        if (this.startVoice && this.startVoice.staff && this.startVoice.staff.voices.length > 0 && this.startVoice.staff.voices[0] === voice)
            return true;
        return false;
    }
}
export default BraceElem;
