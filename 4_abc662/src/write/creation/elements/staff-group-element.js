import calcHeight from '../calc-height';
class StaffGroupElement {
    constructor(getTextSize) {
        this.voices = [];
        this.staffs = [];
        this.w = 0;
        this.height = 0;
        this.getTextSize = getTextSize;
        this.voices = [];
        this.staffs = [];
        this.brace = undefined;
        this.bracket = undefined;
    }
    setLimit(member, voice) {
        if (!voice.specialY[member])
            return;
        if (!voice.staff.specialY[member])
            voice.staff.specialY[member] = voice.specialY[member];
        else
            voice.staff.specialY[member] = Math.max(voice.staff.specialY[member], voice.specialY[member]);
    }
    addVoice(voice, staffnumber, stafflines) {
        const voiceNum = this.voices.length;
        this.voices[voiceNum] = voice;
        if (this.staffs[staffnumber])
            this.staffs[staffnumber].voices.push(voiceNum);
        else {
            this.staffs[staffnumber] = {
                top: 10,
                bottom: 2,
                lines: stafflines,
                voices: [voiceNum],
                specialY: {
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
                }
            };
        }
        voice.staff = this.staffs[staffnumber];
    }
    setHeight() {
        this.height = calcHeight(this);
    }
    setWidth(width) {
        this.w = width;
        for (let i = 0; i < this.voices.length; i++) {
            this.voices[i].setWidth(width);
        }
    }
    setStaffLimits(voice) {
        voice.staff.top = Math.max(voice.staff.top, voice.top);
        voice.staff.bottom = Math.min(voice.staff.bottom, voice.bottom);
        this.setLimit('tempoHeightAbove', voice);
        this.setLimit('partHeightAbove', voice);
        this.setLimit('volumeHeightAbove', voice);
        this.setLimit('dynamicHeightAbove', voice);
        this.setLimit('endingHeightAbove', voice);
        this.setLimit('chordHeightAbove', voice);
        this.setLimit('lyricHeightAbove', voice);
        this.setLimit('lyricHeightBelow', voice);
        this.setLimit('chordHeightBelow', voice);
        this.setLimit('volumeHeightBelow', voice);
        this.setLimit('dynamicHeightBelow', voice);
    }
}
export default StaffGroupElement;
