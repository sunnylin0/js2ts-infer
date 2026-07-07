import sprintf from './sprintf';
import roundNumber from './round-number';
import printStem from './print-stem';
class TabLine {
    options: any;
    name: any;
    klass: any;
    dx: any;
    renderer: any;

    constructor(renderer, klass, dx = 0.35, name) {
        this.renderer = renderer;
        this.dx = dx;
        this.klass = klass;
        this.name = name;
        const fill = renderer.foregroundColor;
        this.options = { stroke: "none", fill: fill };
        if (name)
            this.options['data-name'] = name;
        if (klass)
            this.options['class'] = klass;
    }
    printVertical(y1, y2, x): SVGPathElement {
        return printStem(this.renderer, x, this.dx, y1, y2, this.options.klass, this.options.name);
    }
    printHorizontal(x1, x2, y) {
        x1 = roundNumber(x1);
        x2 = roundNumber(x2);
        const y1: number = roundNumber(y - this.dx);
        const y2: number = roundNumber(y + this.dx);
        this.options.path = sprintf("M %f %f L %f %f L %f %f L %f %f z", x1, y1, x2, y1, x2, y2, x1, y2);
        return this.renderer.paper.pathToBack(this.options);
    }
}
export default TabLine;
