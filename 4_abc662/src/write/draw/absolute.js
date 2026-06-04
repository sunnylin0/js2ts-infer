import drawTempo from './tempo';
import drawRelativeElement from './relative';
import spacing from '../helpers/spacing';
import setClass from '../helpers/set-class';
import elementGroup from './group-elements';
function drawAbsolute(renderer, params, bartop, selectables, staffPos) {
    if (params.invisible)
        return;
    const isTempo = params.children.length > 0 && params.children[0].type === "TempoElement";
    params.elemset = [];
    elementGroup.beginGroup(renderer.paper, renderer.controller);
    for (let i = 0; i < params.children.length; i++) {
        const child = params.children[i];
        switch (child.type) {
            case "TempoElement":
                drawTempo(renderer, child);
                break;
            default:
                const el = drawRelativeElement(renderer, child, bartop);
                if (el && child.type === "symbol" && child.c && typeof child.c === 'string' && child.c.indexOf('notehead') >= 0) {
                    el.setAttribute('class', 'abcjs-notehead');
                }
        }
    }
    let klass = params.type;
    if (params.type === 'note' || params.type === 'rest') {
        const counters = renderer.controller.classes.getCurrent();
        params.counters = counters;
        klass += ' d' + Math.round((params.durationClass || 0) * 1000) / 1000;
        klass = klass.replace(/\./g, '-');
        if (params.abcelem.pitches) {
            for (let j = 0; j < params.abcelem.pitches.length; j++) {
                klass += ' p' + params.abcelem.pitches[j].pitch;
            }
        }
    }
    const g = elementGroup.endGroup(klass, params.type);
    if (g) {
        if (params.cloned) {
            params.cloned.overrideClasses = g.className.baseVal;
        }
        if (params.overrideClasses) {
            const type = g.classList && g.classList.length > 0 ? g.classList[0] + ' ' : '';
            g.setAttribute("class", type + params.overrideClasses);
        }
        if (isTempo) {
            params.startChar = params.abcelem.startChar;
            params.endChar = params.abcelem.endChar;
            selectables.add(params, g, false, staffPos);
        }
        else {
            params.elemset.push(g);
            let isSelectable = false;
            if (params.type === 'note' || params.type === 'tabNumber') {
                isSelectable = true;
            }
            selectables.add(params, g, isSelectable, staffPos);
        }
    }
    else if (params.elemset.length > 0) {
        selectables.add(params, params.elemset[0], params.type === 'note', staffPos);
    }
    if (params.klass)
        setClass(params.elemset, "mark", "", "#00ff00");
    if (params.hint)
        setClass(params.elemset, "abcjs-hint", "", null);
    params.abcelem.abselem = params;
    if (params.heads && params.heads.length > 0) {
        params.notePositions = [];
        for (let jj = 0; jj < params.heads.length; jj++) {
            params.notePositions.push({
                x: params.heads[jj].x + params.heads[jj].w / 2,
                y: staffPos.zero - params.heads[jj].pitch * spacing.STEP
            });
        }
    }
}
export default drawAbsolute;
