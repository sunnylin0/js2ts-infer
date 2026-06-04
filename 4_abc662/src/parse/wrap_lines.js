// wrap_lines.ts: does line wrap on an already parsed tune.
export function wrapLines(tune, lineBreaks, barNumbers) {
    if (!lineBreaks || tune.lines.length === 0)
        return;
    // tune.lines contains nested arrays: there is an array of lines (that's the part this function rewrites),
    // there is an array of staffs per line (for instance, piano will have 2, orchestra will have many)
    // there is an array of voices per staff (for instance, 4-part harmony might have bass and tenor on a single staff)
    const lines = tune.deline({ lineBreaks: false });
    const linesBreakElements = findLineBreaks(lines, lineBreaks);
    tune.lines = addLineBreaks(lines, linesBreakElements, barNumbers);
    tune.lineBreaks = linesBreakElements;
}
function addLineBreaks(lines, linesBreakElements, barNumbers) {
    const outputLines = [];
    const lastKeySig = [];
    const lastStem = [];
    let currentBarNumber = 1;
    for (let i = 0; i < linesBreakElements.length; i++) {
        const action = linesBreakElements[i];
        if (lines[action.ogLine].staff) {
            const inputStaff = lines[action.ogLine].staff[action.staff];
            if (!outputLines[action.line]) {
                outputLines[action.line] = { staff: [] };
            }
            if (!outputLines[action.line].staff[action.staff]) {
                outputLines[action.line].staff[action.staff] = { voices: [] };
                if (barNumbers !== undefined && action.staff === 0 && action.line > 0) {
                    outputLines[action.line].staff[action.staff].barNumber = currentBarNumber;
                }
                const keys = Object.keys(inputStaff);
                for (let k = 0; k < keys.length; k++) {
                    let skip = keys[k] === "voices";
                    if (keys[k] === "meter" && action.line !== 0)
                        skip = true;
                    if (!skip)
                        outputLines[action.line].staff[action.staff][keys[k]] = inputStaff[keys[k]];
                }
                if (lastKeySig[action.staff])
                    outputLines[action.line].staff[action.staff].key = lastKeySig[action.staff];
            }
            if (!outputLines[action.line].staff[action.staff].voices[action.voice]) {
                outputLines[action.line].staff[action.staff].voices[action.voice] = [];
            }
            outputLines[action.line].staff[action.staff].voices[action.voice] =
                lines[action.ogLine].staff[action.staff].voices[action.voice].slice(action.start, action.end + 1);
            if (lastStem[action.staff * 10 + action.voice])
                outputLines[action.line].staff[action.staff].voices[action.voice].unshift({ el_type: "stem", direction: lastStem[action.staff * 10 + action.voice].direction });
            const currVoice = outputLines[action.line].staff[action.staff].voices[action.voice];
            for (let kk = currVoice.length - 1; kk >= 0; kk--) {
                if (currVoice[kk].el_type === "key") {
                    lastKeySig[action.staff] = {
                        root: currVoice[kk].root,
                        acc: currVoice[kk].acc,
                        mode: currVoice[kk].mode,
                        accidentals: currVoice[kk].accidentals.filter(function (acc) { return acc.acc !== 'natural'; })
                    };
                    break;
                }
            }
            for (let kk = currVoice.length - 1; kk >= 0; kk--) {
                if (currVoice[kk].el_type === "stem") {
                    lastStem[action.staff * 10 + action.voice] = {
                        direction: currVoice[kk].direction,
                    };
                    break;
                }
            }
            if (barNumbers !== undefined && action.staff === 0 && action.voice === 0) {
                for (let kk = 0; kk < currVoice.length; kk++) {
                    if (currVoice[kk].el_type === 'bar') {
                        currentBarNumber++;
                        if (kk === currVoice.length - 1)
                            delete currVoice[kk].barNumber;
                        else
                            currVoice[kk].barNumber = currentBarNumber;
                    }
                }
            }
        }
        else {
            outputLines[action.line] = lines[action.ogLine];
        }
    }
    for (let ii = 0; ii < outputLines.length; ii++) {
        if (outputLines[ii] && outputLines[ii].staff) {
            outputLines[ii].staff = outputLines[ii].staff.filter(function (el) {
                return el != null;
            });
        }
    }
    return outputLines;
}
function findLineBreaks(lines, lineBreakArray) {
    const lineBreakIndexes = [];
    let lbai = 0;
    let lineCounter = 0;
    let outputLine = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.staff) {
            const lineStart = lineCounter;
            const lineBreaks = lineBreakArray[lbai];
            lbai++;
            for (let j = 0; j < line.staff.length; j++) {
                const staff = line.staff[j];
                for (let k = 0; k < staff.voices.length; k++) {
                    outputLine = lineStart;
                    let measureNumber = 0;
                    let lbi = 0;
                    const voice = staff.voices[k];
                    let start = 0;
                    for (let e = 0; e < voice.length; e++) {
                        const el = voice[e];
                        if (el.el_type === 'bar') {
                            if (lineBreaks && lineBreaks[lbi] === measureNumber) {
                                lineBreakIndexes.push({ ogLine: i, line: outputLine, staff: j, voice: k, start: start, end: e });
                                start = e + 1;
                                outputLine++;
                                lineCounter = Math.max(lineCounter, outputLine);
                                lbi++;
                            }
                            measureNumber++;
                        }
                    }
                    lineBreakIndexes.push({ ogLine: i, line: outputLine, staff: j, voice: k, start: start, end: voice.length });
                    outputLine++;
                    lineCounter = Math.max(lineCounter, outputLine);
                }
            }
        }
        else {
            lineBreakIndexes.push({ ogLine: i, line: outputLine });
            outputLine++;
            lineCounter = Math.max(lineCounter, outputLine);
        }
    }
    return lineBreakIndexes;
}
function freeFormLineBreaks(widths, lineBreakPoint) {
    const lineBreaks = [];
    const totals = [];
    let totalThisLine = 0;
    for (let i = 0; i < widths.length; i++) {
        const width = widths[i];
        const attemptedWidth = totalThisLine + width;
        if (attemptedWidth < lineBreakPoint)
            totalThisLine = attemptedWidth;
        else {
            const oldDistance = lineBreakPoint - totalThisLine;
            const newDistance = attemptedWidth - lineBreakPoint;
            if (oldDistance < newDistance && totalThisLine > 0) {
                lineBreaks.push(i - 1);
                totals.push(Math.round(totalThisLine - width));
                totalThisLine = width;
            }
            else {
                if (i < widths.length - 1) {
                    lineBreaks.push(i);
                    totals.push(Math.round(totalThisLine));
                    totalThisLine = 0;
                }
            }
        }
    }
    totals.push(Math.round(totalThisLine));
    return { lineBreaks: lineBreaks, totals: totals };
}
function clone(arr) {
    const newArr = [];
    for (let i = 0; i < arr.length; i++)
        newArr.push(arr[i]);
    return newArr;
}
function oneTry(measureWidths, idealWidths, accumulator, lineAccumulator, lineWidths, lastVariance, highestVariance, currLine, lineBreaks, startIndex, otherTries) {
    for (let i = startIndex; i < measureWidths.length; i++) {
        const measureWidth = measureWidths[i];
        accumulator += measureWidth;
        lineAccumulator += measureWidth;
        const thisVariance = Math.abs(accumulator - idealWidths[currLine]);
        const varianceIsClose = Math.abs(thisVariance - lastVariance) < idealWidths[0] / 10;
        if (varianceIsClose) {
            if (thisVariance < lastVariance) {
                const newWidths = clone(lineWidths);
                const newBreaks = clone(lineBreaks);
                newBreaks.push(i - 1);
                newWidths.push(lineAccumulator - measureWidth);
                otherTries.push({
                    accumulator: accumulator,
                    lineAccumulator: measureWidth,
                    lineWidths: newWidths,
                    lastVariance: Math.abs(accumulator - idealWidths[currLine + 1]),
                    highestVariance: Math.max(highestVariance, lastVariance),
                    currLine: currLine + 1,
                    lineBreaks: newBreaks,
                    startIndex: i + 1
                });
            }
            else if (thisVariance > lastVariance && i < measureWidths.length - 1) {
                const newWidths = clone(lineWidths);
                const newBreaks = clone(lineBreaks);
                otherTries.push({
                    accumulator: accumulator,
                    lineAccumulator: lineAccumulator,
                    lineWidths: newWidths,
                    lastVariance: thisVariance,
                    highestVariance: Math.max(highestVariance, thisVariance),
                    currLine: currLine,
                    lineBreaks: newBreaks,
                    startIndex: i + 1
                });
            }
        }
        if (thisVariance > lastVariance) {
            lineBreaks.push(i - 1);
            currLine++;
            highestVariance = Math.max(highestVariance, lastVariance);
            lastVariance = Math.abs(accumulator - idealWidths[currLine]);
            lineWidths.push(lineAccumulator - measureWidth);
            lineAccumulator = measureWidth;
        }
        else {
            lastVariance = thisVariance;
        }
    }
    lineWidths.push(lineAccumulator);
}
function optimizeLineWidths(widths, lineBreakPoint, lineBreaks, explanation) {
    const numLines = Math.ceil(widths.total / lineBreakPoint);
    const idealWidth = Math.floor(widths.total / numLines);
    const idealWidths = [];
    for (let i = 0; i < numLines; i++)
        idealWidths.push(idealWidth * (i + 1));
    const otherTries = [];
    otherTries.push({
        accumulator: 0,
        lineAccumulator: 0,
        lineWidths: [],
        lastVariance: 999999,
        highestVariance: 0,
        currLine: 0,
        lineBreaks: [],
        startIndex: 0
    });
    let index = 0;
    while (index < otherTries.length) {
        oneTry(widths.measureWidths, idealWidths, otherTries[index].accumulator, otherTries[index].lineAccumulator, otherTries[index].lineWidths, otherTries[index].lastVariance, otherTries[index].highestVariance, otherTries[index].currLine, otherTries[index].lineBreaks, otherTries[index].startIndex, otherTries);
        index++;
    }
    for (let i = 0; i < otherTries.length; i++) {
        const otherTry = otherTries[i];
        otherTry.variances = [];
        otherTry.aveVariance = 0;
        for (let j = 0; j < otherTry.lineWidths.length; j++) {
            const lineWidth = otherTry.lineWidths[j];
            otherTry.variances.push(lineWidth - idealWidths[0]);
            otherTry.aveVariance += Math.abs(lineWidth - idealWidths[0]);
        }
        otherTry.aveVariance = otherTry.aveVariance / otherTry.lineWidths.length;
        explanation.attempts.push({ type: "optimizeLineWidths", lineBreaks: otherTry.lineBreaks, variances: otherTry.variances, aveVariance: otherTry.aveVariance, widths: widths.measureWidths });
    }
    let smallest = 9999999;
    let smallestIndex = -1;
    for (let i = 0; i < otherTries.length; i++) {
        const otherTry = otherTries[i];
        if (otherTry.aveVariance < smallest) {
            smallest = otherTry.aveVariance;
            smallestIndex = i;
        }
    }
    return { failed: false, lineBreaks: otherTries[smallestIndex].lineBreaks, variance: otherTries[smallestIndex].highestVariance };
}
function fixedMeasureLineBreaks(widths, lineBreakPoint, preferredMeasuresPerLine) {
    const lineBreaks = [];
    const totals = [];
    let thisWidth = 0;
    let failed = false;
    for (let i = 0; i < widths.length; i++) {
        thisWidth += widths[i];
        if (thisWidth > lineBreakPoint) {
            failed = true;
        }
        if (i % preferredMeasuresPerLine === (preferredMeasuresPerLine - 1)) {
            if (i !== widths.length - 1)
                lineBreaks.push(i);
            totals.push(Math.round(thisWidth));
            thisWidth = 0;
        }
    }
    return { failed: failed, totals: totals, lineBreaks: lineBreaks };
}
function getRevisedTuneParams(lineBreaks, staffWidth, params) {
    const revisedParams = {
        lineBreaks: lineBreaks,
        staffwidth: staffWidth
    };
    for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key) && key !== 'wrap' && key !== 'staffwidth') {
            revisedParams[key] = params[key];
        }
    }
    return { revisedParams: revisedParams };
}
export function calcLineWraps(tune, widths, params) {
    if (widths.length === 0 || params.staffwidth < widths[0].left) {
        return {
            reParse: false,
            explanation: "Staff width is narrower than the margin",
            revisedParams: params
        };
    }
    const scale = params.scale ? Math.max(params.scale, 0.1) : 1;
    const minSpacing = params.wrap.minSpacing ? Math.max(parseFloat(params.wrap.minSpacing), 1) : 1;
    const minSpacingLimit = params.wrap.minSpacingLimit ? Math.max(parseFloat(params.wrap.minSpacingLimit), 1) : minSpacing - 0.1;
    let maxSpacing = params.wrap.maxSpacing ? Math.max(parseFloat(params.wrap.maxSpacing), 1) : undefined;
    if (params.wrap.lastLineLimit && !maxSpacing)
        maxSpacing = Math.max(parseFloat(params.wrap.lastLineLimit), 1);
    const preferredMeasuresPerLine = params.wrap.preferredMeasuresPerLine ? Math.max(parseInt(params.wrap.preferredMeasuresPerLine, 10), 0) : undefined;
    const accumulatedLineBreaks = [];
    const explanations = [];
    for (let s = 0; s < widths.length; s++) {
        const section = widths[s];
        const usableWidth = params.staffwidth - section.left;
        const lineBreakPoint = usableWidth / minSpacing / scale;
        const minLineSize = maxSpacing ? usableWidth / maxSpacing / scale : 0;
        const allowableVariance = usableWidth / minSpacingLimit / scale;
        const explanation = {
            widths: section,
            lineBreakPoint: lineBreakPoint,
            minLineSize: minLineSize,
            attempts: [],
            staffWidth: params.staffwidth,
            minWidth: Math.round(allowableVariance)
        };
        let lineBreaks = null;
        if (preferredMeasuresPerLine) {
            const f = fixedMeasureLineBreaks(section.measureWidths, lineBreakPoint, preferredMeasuresPerLine);
            explanation.attempts.push({
                type: "Fixed Measures Per Line",
                preferredMeasuresPerLine: preferredMeasuresPerLine,
                lineBreaks: f.lineBreaks,
                failed: f.failed,
                totals: f.totals
            });
            if (!f.failed)
                lineBreaks = f.lineBreaks;
        }
        if (!lineBreaks) {
            let ff = freeFormLineBreaks(section.measureWidths, lineBreakPoint);
            explanation.attempts.push({ type: "Free Form", lineBreaks: ff.lineBreaks, totals: ff.totals });
            lineBreaks = ff.lineBreaks;
            if (lineBreaks && lineBreaks.length > 0 && section.measureWidths.length < 25) {
                ff = optimizeLineWidths(section, lineBreakPoint, lineBreaks, explanation);
                explanation.attempts.push({
                    type: "Optimize",
                    failed: ff.failed,
                    reason: ff.reason,
                    lineBreaks: ff.lineBreaks,
                    totals: ff.totals
                });
                if (!ff.failed)
                    lineBreaks = ff.lineBreaks;
            }
        }
        accumulatedLineBreaks.push(lineBreaks);
        explanations.push(explanation);
    }
    const staffWidth = params.staffwidth;
    const ret = getRevisedTuneParams(accumulatedLineBreaks, staffWidth, params);
    ret.explanation = explanations;
    ret.reParse = true;
    return ret;
}
