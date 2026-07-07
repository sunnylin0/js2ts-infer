/**
 * Begin a group of glyphs that will always be moved, scaled and highlighted together
 */
import roundNumber from "./round-number";
class Group {
    controller: EngraverController;
    paper: Svg;
    ingroup: boolean = false;
    path: Array<any> = [];
    lastM: Array<number> = [0, 0];

    constructor() {
    }
    beginGroup(paper: Svg, controller: EngraverController): void {
        this.paper = paper;
        this.controller = controller;
        this.path = [];
        this.lastM = [0, 0];
        this.ingroup = true;
        this.paper.openGroup();
    }
    isInGroup(): boolean {
        return this.ingroup;
    }
    addPath(path): void {
        const p = path || [];
        if (p.length === 0)
            return;
        p[0][0] = "m";
        p[0][1] = roundNumber(p[0][1] - this.lastM[0]);
        p[0][2] = roundNumber(p[0][2] - this.lastM[1]);
        this.lastM[0] += p[0][1];
        this.lastM[1] += p[0][2];
        this.path.push(p[0]);
        for (let i: number = 1, ii = p.length; i < ii; i++) {
            if (p[i][0] === "m") {
                this.lastM[0] += p[i][1];
                this.lastM[1] += p[i][2];
            }
            this.path.push(p[i]);
        }
    }
    /**
     * End a group of glyphs that will always be moved, scaled and highlighted together
     */
    endGroup(klass: string, name: string): SVGGElement {
        this.ingroup = false;
        //if (this.path.length === 0) return null;
        let pathStr: string = "";
        for (let i: number = 0; i < this.path.length; i++)
            pathStr += this.path[i].join(" ");
        this.path = [];
        const ret: SVGGElement = this.paper.closeGroup();
        if (ret) {
            ret.setAttribute("class", this.controller.classes.generate(klass));
            ret.setAttribute("fill", this.controller.renderer.foregroundColor);
            ret.setAttribute("stroke", "none");
            ret.setAttribute("data-name", name);
        }
        return ret;
    }
}
// There is just a singleton of this object.
const elementGroup: Group = new Group();
export default elementGroup;
