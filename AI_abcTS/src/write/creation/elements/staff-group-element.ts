import calcHeight from '../calc-height';

interface Staff {
	top: number;
	bottom: number;
	lines: number;
	voices: number[];
	specialY: Record<string, number>;
}

class StaffGroupElement {
	public getTextSize: any;
	public voices: any[] = [];
	public staffs: Staff[] = [];
	public brace: any;
	public bracket: any;
	public w = 0;
	public height = 0;

	constructor(getTextSize: any) {
		this.getTextSize = getTextSize;
		this.voices = [];
		this.staffs = [];
		this.brace = undefined;
		this.bracket = undefined;
	}

	private setLimit(member: string, voice: any): void {
		if (!voice.specialY[member]) return;
		if (!voice.staff.specialY[member])
			voice.staff.specialY[member] = voice.specialY[member];
		else
			voice.staff.specialY[member] = Math.max(voice.staff.specialY[member], voice.specialY[member]);
	}

	public addVoice(voice: any, staffnumber: number, stafflines: number): void {
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

	public setHeight(): void {
		this.height = calcHeight(this);
	}

	public setWidth(width: number): void {
		this.w = width;
		for (let i = 0; i < this.voices.length; i++) {
			this.voices[i].setWidth(width);
		}
	}

	public setStaffLimits(voice: any): void {
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
