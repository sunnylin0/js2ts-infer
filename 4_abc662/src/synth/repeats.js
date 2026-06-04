import parseCommon from "../parse/abc_common";
export default class Repeats {
    constructor(voice) {
        this.voice = voice;
        this.sections = [{ type: 'startRepeat', index: -1 }];
    }
    addBar(elem) {
        var thisIndex = this.voice.length - 1;
        var isStartRepeat = elem.type === "bar_left_repeat" || elem.type === "bar_dbl_repeat";
        var isEndRepeat = elem.type === "bar_right_repeat" || elem.type === "bar_dbl_repeat";
        var startEnding = elem.startEnding ? this.startEndingNumbers(elem.startEnding) : undefined;
        if (isEndRepeat) {
            if (this.sections.length > 0 && this.sections[this.sections.length - 1].type === 'endRepeat')
                this.sections.push({ type: "startRepeat", index: this.sections[this.sections.length - 1].index });
            this.sections.push({ type: "endRepeat", index: thisIndex });
        }
        if (isStartRepeat)
            this.sections.push({ type: "startRepeat", index: thisIndex });
        if (startEnding)
            this.sections.push({ type: "startEnding", index: thisIndex, endings: startEnding });
    }
    resolveRepeats() {
        var e;
        var lastSection = this.sections[this.sections.length - 1];
        var lastElement = this.voice.length - 1;
        if (lastSection.type === 'startRepeat')
            lastSection.end = lastElement;
        else if (lastSection.index + 1 < lastElement)
            this.sections.push({ type: "startRepeat", index: lastSection.index + 1 });
        if (this.sections.length < 2)
            return this.voice;
        var repeatInstructions = [];
        var currentRepeat = null;
        for (var i = 0; i < this.sections.length; i++) {
            var section = this.sections[i];
            switch (section.type) {
                case "startRepeat":
                    if (currentRepeat) {
                        if (!currentRepeat.common.end)
                            currentRepeat.common.end = section.index;
                        if (currentRepeat.endings) {
                            for (e = 0; e < currentRepeat.endings.length; e++) {
                                if (currentRepeat.endings[e] && !currentRepeat.endings[e].end && currentRepeat.endings[e].start !== section.index)
                                    currentRepeat.endings[e].end = section.index;
                            }
                        }
                        if (i > 0 && this.sections[i - 1].type === 'endRepeat' && currentRepeat.endings && currentRepeat.endings.length)
                            currentRepeat.endings[currentRepeat.endings.length] = { start: -1, end: -1 };
                        repeatInstructions.push(currentRepeat);
                    }
                    if (currentRepeat) {
                        var lastUsed = currentRepeat.common.end;
                        if (currentRepeat.endings) {
                            for (e = 0; e < currentRepeat.endings.length; e++) {
                                if (currentRepeat.endings[e])
                                    lastUsed = Math.max(lastUsed, currentRepeat.endings[e].end);
                            }
                        }
                        if (lastUsed < section.index - 1) {
                            repeatInstructions.push({ common: { start: lastUsed + 1, end: section.index } });
                        }
                    }
                    currentRepeat = { common: { start: section.index } };
                    break;
                case "startEnding": {
                    if (currentRepeat) {
                        if (!currentRepeat.common.end)
                            currentRepeat.common.end = section.index;
                        if (!currentRepeat.endings)
                            currentRepeat.endings = [];
                        for (e = 0; e < section.endings.length; e++)
                            currentRepeat.endings[section.endings[e]] = { start: section.index + 1 };
                    }
                    break;
                }
                case "endRepeat":
                    if (currentRepeat) {
                        if (!currentRepeat.endings)
                            currentRepeat.endings = [];
                        if (currentRepeat.endings.length > 0) {
                            for (e = 0; e < currentRepeat.endings.length; e++) {
                                if (currentRepeat.endings[e] && !currentRepeat.endings[e].end)
                                    currentRepeat.endings[e].end = section.index;
                            }
                        }
                        if (!currentRepeat.common.end)
                            currentRepeat.common.end = section.index;
                    }
                    break;
            }
        }
        if (currentRepeat) {
            if (!currentRepeat.common.end)
                currentRepeat.common.end = lastElement;
            if (currentRepeat.endings) {
                for (e = 0; e < currentRepeat.endings.length; e++) {
                    if (currentRepeat.endings[e] && !currentRepeat.endings[e].end)
                        currentRepeat.endings[e].end = lastElement;
                }
            }
            repeatInstructions.push(currentRepeat);
        }
        var output = [];
        var lastEnd = -1;
        for (var r = 0; r < repeatInstructions.length; r++) {
            var instructions = repeatInstructions[r];
            if (!instructions.endings) {
                this.duplicateSpan(this.voice, output, instructions.common.start, instructions.common.end);
            }
            else if (instructions.endings.length === 0) {
                this.duplicateSpan(this.voice, output, instructions.common.start, instructions.common.end);
                this.duplicateSpan(this.voice, output, instructions.common.start, instructions.common.end);
            }
            else {
                for (e = 0; e < instructions.endings.length; e++) {
                    var ending = instructions.endings[e];
                    if (ending) {
                        this.duplicateSpan(this.voice, output, instructions.common.start, instructions.common.end);
                        if (ending.start > 0) {
                            this.duplicateSpan(this.voice, output, ending.start, ending.end);
                        }
                        lastEnd = Math.max(lastEnd, ending.end);
                    }
                }
            }
        }
        return output;
    }
    duplicateSpan(input, output, start, end) {
        if (start < 0)
            start = 0;
        if (output.length > 0 && input[start].el_type === 'bar' && output[output.length - 1].el_type === 'bar')
            start++;
        for (var i = start; i <= end; i++) {
            var index;
            var skip = false;
            if (input[i].el_type === 'key' || input[i].el_type === 'meter' || input[i].el_type === 'tempo' || input[i].el_type === 'instrument') {
                index = output.length - 1;
                while (index >= 0 && output[index].el_type !== input[i].el_type)
                    index--;
                if (index >= 0) {
                    if (input[i].el_type === 'key' && this.areKeysEqual(input[i], output[index])) {
                        skip = true;
                    }
                    else if (input[i].el_type === 'meter' && input[i].num === output[index].num && input[i].den === output[index].den) {
                        skip = true;
                    }
                    else if (input[i].el_type === 'instrument' && input[i].program === output[index].program) {
                        skip = true;
                    }
                    else if (input[i].el_type === 'tempo' && input[i].qpm === output[index].qpm) {
                        skip = true;
                    }
                }
            }
            if (!skip)
                output.push(this.duplicateItem(input[i]));
        }
    }
    duplicateItem(src) {
        var item = Object.assign({}, src);
        if (item.pitches)
            item.pitches = parseCommon.cloneArray(item.pitches);
        return item;
    }
    areKeysEqual(el1, el2) {
        if (!el1.accidentals || !el2.accidentals)
            return false;
        return JSON.stringify(el1.accidentals) === JSON.stringify(el2.accidentals);
    }
    startEndingNumbers(startEnding) {
        var nums = [];
        var ending, endings, i;
        if (startEnding.indexOf(',') > 0) {
            endings = startEnding.split(',');
            for (i = 0; i < endings.length; i++) {
                ending = parseInt(endings[i], 10);
                if (ending > 0) {
                    nums.push(ending);
                }
            }
        }
        else if (startEnding.indexOf('-') > 0) {
            endings = startEnding.split('-');
            var se = parseInt(endings[0], 10);
            var ee = parseInt(endings[1], 10);
            for (i = se; i <= ee; i++) {
                nums.push(i);
            }
        }
        else {
            ending = parseInt(startEnding, 10);
            if (ending > 0) {
                nums.push(ending);
            }
        }
        return nums;
    }
}
