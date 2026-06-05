/**
 * Definition of the RelativeElement class.
 */

class RelativeElement {
	public x = 0;
	public c: any;      // character or path or string
	public dx: number;    // relative x position
	public w: number;      // minimum width taken up by this element (can include gratuitous space)
	public pitch: number; // relative y position by pitch
	public scalex: number; // should the character/path be scaled?
	public scaley: number; // should the character/path be scaled?
	public type: string; // cheap types.
	public pitch2?: number;
	public linewidth?: number;
	public klass?: string;
	public anchor: 'start' | 'middle' | 'end';
	public top: number;
	public bottom: number;
	public dim: any;
	public position?: string;
	public height: number;
	public name: string;
	public realWidth: number;
	public centerVertically = false;
	public parent: any;
	public lane?: number;
	public lyricHeightBelow?: number;
	public lyricHeightAbove?: number;
	public chordHeightBelow?: number;
	public chordHeightAbove?: number;
	public partHeightAbove?: number;
	public stemDir?: string;

	constructor(c: any, dx: number, w: number, pitch: number, opt: any = {}) {
		this.c = c;
		this.dx = dx;
		this.w = w;
		this.pitch = pitch;
		this.scalex = opt.scalex || 1;
		this.scaley = opt.scaley || 1;
		this.type = opt.type || "symbol";
		this.pitch2 = opt.pitch2;
		this.linewidth = opt.linewidth;
		this.klass = opt.klass;
		this.anchor = opt.anchor ? opt.anchor : 'middle';

		this.top = pitch;
		if (this.pitch2 !== undefined && this.pitch2 > this.top) this.top = this.pitch2;

		this.bottom = pitch;
		if (this.pitch2 !== undefined && this.pitch2 < this.bottom) this.bottom = this.pitch2;

		if (opt.thickness) {
			this.top += opt.thickness / 2;
			this.bottom -= opt.thickness / 2;
		}
		if (opt.stemHeight) {
			if (opt.stemHeight > 0)
				this.top += opt.stemHeight;
			else
				this.bottom += opt.stemHeight;
		}
		if (opt.dim)
			this.dim = opt.dim;
		if (opt.position)
			this.position = opt.position;

		this.height = opt.height ? opt.height : 4;
		if (opt.top !== undefined)
			this.top = opt.top;
		if (opt.bottom !== undefined)
			this.bottom = opt.bottom;

		if (opt.name)
			this.name = opt.name;
		else if (this.c)
			this.name = this.c;
		else
			this.name = this.type;

		if (opt.realWidth !== undefined)
			this.realWidth = opt.realWidth;
		else
			this.realWidth = this.w;

		switch (this.type) {
			case "debug":
				this.chordHeightAbove = this.height;
				break;
			case "lyric":
				if (opt.position && opt.position === 'below')
					this.lyricHeightBelow = this.height;
				else
					this.lyricHeightAbove = this.height;
				break;
			case "chord":
				if (opt.position && opt.position === 'below')
					this.chordHeightBelow = this.height;
				else
					this.chordHeightAbove = this.height;
				break;
			case "text":
				if (this.pitch === undefined) {
					if (opt.position && opt.position === 'below')
						this.chordHeightBelow = this.height;
					else
						this.chordHeightAbove = this.height;
				} else
					this.centerVertically = true;
				break;
			case "part": this.partHeightAbove = this.height; break;
		}
	}

	public getChordDim(): { left: number, right: number } | null {
		if (this.type === "debug")
			return null;
		if (!this.chordHeightAbove && !this.chordHeightBelow)
			return null;

		const offset = this.type === "chord" ? this.realWidth / 2 : 0;
		const left = this.x - offset;
		const right = left + this.realWidth;
		return { left: left, right: right };
	}

	public invertLane(total: number): void {
		if (this.lane === undefined)
			this.lane = 0;
		this.lane = total - this.lane - 1;
	}

	public putChordInLane(i: number): void {
		this.lane = i;
		// Add some extra space to account for the character's descenders.
		if (this.chordHeightAbove !== undefined)
			this.chordHeightAbove = (this.height * 1.25) * this.lane;
		else if (this.chordHeightBelow !== undefined)
			this.chordHeightBelow = (this.height * 1.25) * this.lane;
	}

	public getLane(): number {
		if (this.lane === undefined)
			return 0;
		return this.lane;
	}

	public setX(x: number): void {
		this.x = x + this.dx;
	}
}

export default RelativeElement;
