class VoiceElement {
  voicetotal: number;
  voicenumber: number;
  children: AbsoluteElement[] = [];
  beams: (BeamElem | string)[] = [];
  /** ties, slurs, triplets */
  otherchildren: (string | TieElem | EndingElem | TripletElem | CrescendoElem)[] = [];
  w: number = 0;
  duplicate: boolean = false;
  bottom: number = 7;
  top: number = 7;
  specialY: SpecialY = {} as SpecialY;

  i: number;
  durationindex: number;
  startx: number;
  minx: number;
  nextx: number;
  spacingduration: number;

  constructor(voicenumber: number, voicetotal: number) {
    this.voicenumber = voicenumber;
    this.voicetotal = voicetotal;
    this.specialY = {
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
  addChild(absElem: AbsoluteElement): void {
    if (absElem.type === 'bar') {
      let firstItem: boolean = true;
      for (let i: number = 0; firstItem && i < this.children.length; i++) {
        if (this.children[i].type.indexOf("staff-extra") < 0 && this.children[i].type !== "tempo")
          firstItem = false;
      }
      if (!firstItem) {
        this.beams.push("bar");
        this.otherchildren.push("bar");
      }
    }
    this.children.push(absElem);
    this.setRange(absElem);
  }
  setLimit(member: string, child: AbsoluteElement | TieElem | EndingElem | TripletElem | CrescendoElem): void {
    let specialY = child.specialY;
    if (!specialY)
      specialY = child;
    if (!specialY[member])
      return;
    if (!this.specialY[member])
      this.specialY[member] = specialY[member];
    else
      this.specialY[member] = Math.max(this.specialY[member], specialY[member]);
  }
  adjustRange(child: AbsoluteElement | TieElem | EndingElem | TripletElem | CrescendoElem): void {
    if (child.bottom !== undefined)
      this.bottom = Math.min(this.bottom, child.bottom);
    if (child.top !== undefined)
      this.top = Math.max(this.top, child.top);
  }
  setRange(child: AbsoluteElement | TieElem | EndingElem | TripletElem | CrescendoElem): void {
    this.adjustRange(child);
    this.setLimit('tempoHeightAbove', child);
    this.setLimit('partHeightAbove', child);
    this.setLimit('volumeHeightAbove', child);
    this.setLimit('dynamicHeightAbove', child);
    this.setLimit('endingHeightAbove', child);
    this.setLimit('chordHeightAbove', child);
    this.setLimit('lyricHeightAbove', child);
    this.setLimit('lyricHeightBelow', child);
    this.setLimit('chordHeightBelow', child);
    this.setLimit('volumeHeightBelow', child);
    this.setLimit('dynamicHeightBelow', child);
  }
  addOther(child: TieElem | EndingElem | TripletElem | CrescendoElem): void {
    this.otherchildren.push(child);
    this.setRange(child);
  }
  addBeam(child: BeamElem): void {
    this.beams.push(child);
  }
  setWidth(width: number): void {
    this.w = width;
  }
}
export default VoiceElement;
