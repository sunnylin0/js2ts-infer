export default class TimingCallbacks {
    reportNext: any;
    totalBeats: any;
    beatStarts: any;
    lastMoment: any;
    millisecondsPerBeat: any;
    newSeekPercent: any;
    justUnpaused: any;
    pausedPercent: any;
    isRunning: any;
    isPaused: any;
    currentLine: any;
    currentEvent: any;
    currentBeat: any;
    lineEndTimings: any;
    noteTimings: any;
    currentTime: any;
    startTime: any;
    lastTimestamp: any;
    beatSubdivisions: any;
    lineEndAnticipation: any;
    lineEndCallback: any;
    eventCallback: any;
    beatCallback: any;
    extraMeasuresAtBeginning: any;
    qpm: any;
    joggerTimer = null;

    constructor(target, params) {
        if (!params)
            params = {};
        this.qpm = params.qpm ? parseInt(params.qpm, 10) : null;
        if (!this.qpm) {
            var tempo = target.metaText ? target.metaText.tempo : null;
            this.qpm = target.getBpm(tempo);
        }
        this.extraMeasuresAtBeginning = params.extraMeasuresAtBeginning ? parseInt(params.extraMeasuresAtBeginning, 10) : 0;
        this.beatCallback = params.beatCallback; // This is called for each beat.
        this.eventCallback = params.eventCallback; // This is called for each note or rest encountered.
        this.lineEndCallback = params.lineEndCallback; // This is called when the end of a line is approaching.
        this.lineEndAnticipation = params.lineEndAnticipation ? parseInt(params.lineEndAnticipation, 10) : 0; // How many milliseconds before the end should the call happen.
        this.beatSubdivisions = params.beatSubdivisions ? parseInt(params.beatSubdivisions, 10) : 1; // how many callbacks per beat is desired.
        if (!this.beatSubdivisions)
            this.beatSubdivisions = 1;
        this.replaceTarget(target);
    }
    doTiming = (timestamp) => {
        if (this.lastTimestamp === timestamp)
            return;
        this.lastTimestamp = timestamp;
        if (!this.isPaused && this.isRunning) {
            if (!this.startTime) {
                this.startTime = timestamp;
            }
            this.currentTime = timestamp - this.startTime;
            this.currentTime += 16;
            while (this.noteTimings.length > this.currentEvent && this.noteTimings[this.currentEvent].milliseconds < this.currentTime) {
                if (this.eventCallback && this.noteTimings[this.currentEvent].type === 'event') {
                    var thisStartTime = this.startTime;
                    this.eventCallback(this.noteTimings[this.currentEvent]);
                    if (thisStartTime !== this.startTime) {
                        this.currentTime = timestamp - this.startTime;
                    }
                }
                this.currentEvent++;
            }
            if (this.lineEndCallback && this.lineEndTimings.length > this.currentLine && this.lineEndTimings[this.currentLine].milliseconds < this.currentTime && this.currentEvent < this.noteTimings.length) {
                var leftEvent = this.noteTimings[this.currentEvent].milliseconds === this.currentTime ? this.noteTimings[this.currentEvent] : this.noteTimings[this.currentEvent - 1];
                this.lineEndCallback(this.lineEndTimings[this.currentLine], leftEvent, { line: this.currentLine, endTimings: this.lineEndTimings, currentTime: this.currentTime });
                this.currentLine++;
            }
            if (this.currentTime < this.lastMoment) {
                requestAnimationFrame(this.doTiming);
                if (this.currentBeat < this.beatStarts.length && this.beatStarts[this.currentBeat].ts <= this.currentTime) {
                    var ret: number = this.doBeatCallback(timestamp);
                    this.currentBeat++;
                    if (ret !== null)
                        this.currentTime = ret;
                }
            }
            else if (this.currentBeat <= this.totalBeats) {
                if (this.beatCallback) {
                    var ret2: number = this.doBeatCallback(timestamp);
                    this.currentBeat++;
                    if (ret2 !== null)
                        this.currentTime = ret2;
                    requestAnimationFrame(this.doTiming);
                }
            }
            if (this.currentTime >= this.lastMoment) {
                if (this.eventCallback) {
                    var promise = this.eventCallback(null);
                    this.shouldStop(promise).then((shouldStop) => {
                        if (shouldStop)
                            this.stop();
                    });
                }
                else
                    this.stop();
            }
        }
    };
    animationJogger = () => {
        if (this.isRunning) {
            this.doTiming(performance.now());
            this.joggerTimer = setTimeout(this.animationJogger, 60);
        }
    };
    replaceTarget(newTarget): void {
        this.noteTimings = newTarget.setTiming(this.qpm, this.extraMeasuresAtBeginning);
        if (newTarget.noteTimings.length === 0)
            this.noteTimings = newTarget.setTiming(0, 0);
        if (this.lineEndCallback) {
            this.lineEndTimings = getLineEndTimings(newTarget.noteTimings, this.lineEndAnticipation);
        }
        this.startTime = null;
        this.currentBeat = 0;
        this.currentEvent = 0;
        this.currentLine = 0;
        this.currentTime = 0;
        this.isPaused = false;
        this.isRunning = false;
        this.pausedPercent = null;
        this.justUnpaused = false;
        this.newSeekPercent = 0;
        this.lastTimestamp = 0;
        if (this.noteTimings.length === 0)
            return;
        // noteTimings contains an array of events sorted by time. Events that happen at the same time are in the same element of the array.
        this.millisecondsPerBeat = 1000 / (this.qpm / 60) / this.beatSubdivisions;
        this.lastMoment = this.noteTimings[this.noteTimings.length - 1].milliseconds;
        var meter = newTarget.getMeter();
        var irregularMeter: string = '';
        if (meter && meter.type === "specified" && meter.value && meter.value.length > 0 && meter.value[0].num.indexOf('+') > 0)
            irregularMeter = meter.value[0].num;
        this.beatStarts = [];
        if (irregularMeter) {
            var measureLength = this.noteTimings[this.noteTimings.length - 1].millisecondsPerMeasure;
            var numMeasures: number = this.lastMoment / measureLength;
            var parts: string[] = irregularMeter.split("+");
            for (var i: number = 0; i < parts.length; i++)
                parts[i] = parseInt(parts[i], 10) / 2;
            var currentTs: number = 0;
            var beatNumber: number = 0;
            for (var measureNumber: number = 0; measureNumber < numMeasures; measureNumber++) {
                var measureStartTs: number = measureNumber * measureLength;
                var subBeatCounter: number = 0;
                for (var kk: number = 0; kk < parts.length; kk++) {
                    var beatLength: string = parts[kk];
                    if (this.beatSubdivisions === 1) {
                        if (this.beatSubdivisions === 1)
                            if (currentTs < this.lastMoment) {
                                this.beatStarts.push({ b: beatNumber, ts: currentTs });
                            }
                        currentTs += beatLength * this.millisecondsPerBeat;
                    }
                    else {
                        var numDivisions: number = beatLength * this.beatSubdivisions;
                        for (var k: number = 0; k < Math.floor(numDivisions); k++) {
                            var subBeat: number = k / numDivisions;
                            var ts: number = Math.round(measureStartTs + subBeatCounter * this.millisecondsPerBeat);
                            if (ts < this.lastMoment) {
                                this.beatStarts.push({ b: beatNumber + subBeat, ts: ts });
                            }
                            subBeatCounter++;
                        }
                    }
                    beatNumber++;
                }
            }
            this.beatStarts.push({ b: numMeasures * parts.length, ts: this.lastMoment });
            this.totalBeats = this.beatStarts.length;
        }
        else {
            this.totalBeats = Math.round(this.lastMoment / this.millisecondsPerBeat);
            for (var j: number = 0; j < this.totalBeats + 1; j++) {
                this.beatStarts.push({ b: j / this.beatSubdivisions, ts: Math.round(j * this.millisecondsPerBeat) });
            }
        }
    }
    shouldStop(promise): Promise<unknown> {
        return new Promise((resolve) => {
            if (!promise)
                return resolve(true);
            if (promise === "continue")
                return resolve(false);
            if (promise.then) {
                promise.then((result) => {
                    resolve(result !== "continue");
                });
            }
            else {
                resolve(true);
            }
        });
    }
    doBeatCallback(timestamp): number {
        if (this.beatCallback) {
            var next = this.currentEvent;
            while (next < this.noteTimings.length && this.noteTimings[next].left === null)
                next++;
            var endMs;
            var ev;
            if (next < this.noteTimings.length) {
                endMs = this.noteTimings[next].milliseconds;
                next = Math.max(0, this.currentEvent - 1);
                while (next >= 0 && this.noteTimings[next].left === null)
                    next--;
                ev = this.noteTimings[next];
            }
            var position: {} = {};
            var debugInfo: {} = {};
            if (ev) {
                position.top = ev.top;
                position.height = ev.height;
                var offMs: number = Math.max(0, timestamp - this.startTime - ev.milliseconds);
                var gapMs: number = endMs - ev.milliseconds;
                var gapPx: number = ev.endX - ev.left;
                var offPx: number = gapMs ? offMs * gapPx / gapMs : 0;
                position.left = ev.left + offPx;
                if (this.currentEvent === 0 && ev.milliseconds > timestamp - this.startTime)
                    position.left = undefined;
                debugInfo = {
                    timestamp: timestamp,
                    startTime: this.startTime,
                    ev: ev,
                    endMs: endMs,
                    offMs: offMs,
                    offPx: offPx,
                    gapMs: gapMs,
                    gapPx: gapPx
                };
            }
            else {
                debugInfo = {
                    timestamp: timestamp,
                    startTime: this.startTime,
                };
            }
            var thisStartTime = this.startTime;
            this.beatCallback(this.beatStarts[this.currentBeat].b, this.totalBeats / this.beatSubdivisions, this.lastMoment, position, debugInfo);
            if (thisStartTime !== this.startTime) {
                return timestamp - this.startTime;
            }
        }
        return null;
    }
    start(offsetPercent, units): void {
        this.isRunning = true;
        if (this.isPaused) {
            this.isPaused = false;
            if (offsetPercent === undefined)
                this.justUnpaused = true;
        }
        if (offsetPercent !== undefined) {
            this.setProgress(offsetPercent, units);
        }
        else if (offsetPercent === 0) {
            this.reset();
        }
        else if (this.pausedPercent !== null) {
            var now: number = performance.now();
            this.currentTime = this.lastMoment * this.pausedPercent;
            this.startTime = now - this.currentTime;
            this.pausedPercent = null;
            this.reportNext = true;
        }
        requestAnimationFrame(this.doTiming);
        this.joggerTimer = setTimeout(this.animationJogger, 60);
    }
    pause(): void {
        this.isPaused = true;
        var now: number = performance.now();
        this.pausedPercent = (now - this.startTime) / this.lastMoment;
        this.isRunning = false;
        if (this.joggerTimer) {
            clearTimeout(this.joggerTimer);
            this.joggerTimer = null;
        }
    }
    currentMillisecond() {
        return this.currentTime;
    }
    reset(): void {
        this.currentBeat = 0;
        this.currentEvent = 0;
        this.currentLine = 0;
        this.startTime = null;
        this.pausedPercent = null;
    }
    stop(): void {
        this.pause();
        this.reset();
    }
    setProgress(position, units): void {
        var percent;
        switch (units) {
            case "seconds":
                this.currentTime = position * 1000;
                if (this.currentTime < 0)
                    this.currentTime = 0;
                if (this.currentTime > this.lastMoment)
                    this.currentTime = this.lastMoment;
                percent = this.currentTime / this.lastMoment;
                break;
            case "beats":
                this.currentTime = position * this.millisecondsPerBeat * this.beatSubdivisions;
                if (this.currentTime < 0)
                    this.currentTime = 0;
                if (this.currentTime > this.lastMoment)
                    this.currentTime = this.lastMoment;
                percent = this.currentTime / this.lastMoment;
                break;
            default:
                percent = position;
                if (percent < 0)
                    percent = 0;
                if (percent > 1)
                    percent = 1;
                this.currentTime = this.lastMoment * percent;
                break;
        }
        if (!this.isRunning)
            this.pausedPercent = percent;
        var now: number = performance.now();
        this.startTime = now - this.currentTime;
        this.currentEvent = 0;
        while (this.noteTimings.length > this.currentEvent && this.noteTimings[this.currentEvent].milliseconds < this.currentTime) {
            this.currentEvent++;
        }
        if (this.lineEndCallback) {
            this.currentLine = 0;
            while (this.lineEndTimings.length > this.currentLine && this.lineEndTimings[this.currentLine].milliseconds + this.lineEndAnticipation < this.currentTime) {
                this.currentLine++;
            }
        }
        var oldBeat = this.currentBeat;
        for (this.currentBeat = 0; this.currentBeat < this.beatStarts.length; this.currentBeat++) {
            if (this.beatStarts[this.currentBeat].ts > this.currentTime)
                break;
        }
        this.currentBeat--;
        if (this.beatCallback && oldBeat !== this.currentBeat) {
            this.doBeatCallback(this.startTime + this.currentTime);
            this.currentBeat++;
        }
        if (this.eventCallback && this.currentEvent >= 0 && this.noteTimings[this.currentEvent].type === 'event')
            this.eventCallback(this.noteTimings[this.currentEvent]);
        if (this.lineEndCallback && this.lineEndTimings && this.lineEndTimings[this.currentLine])
            this.lineEndCallback(this.lineEndTimings[this.currentLine], this.noteTimings[this.currentEvent], { line: this.currentLine, endTimings: this.lineEndTimings });
        this.joggerTimer = setTimeout(this.animationJogger, 60);
    }
}
function getLineEndTimings(timings, anticipation): any[] {
    var callbackTimes = [];
    var lastTop = null;
    for (var i: number = 0; i < timings.length; i++) {
        var timing = timings[i];
        if (timing.type !== 'end' && timing.top !== lastTop) {
            callbackTimes.push({ measureNumber: timing.measureNumber, milliseconds: timing.milliseconds - anticipation, top: timing.top, bottom: timing.top + timing.height });
            lastTop = timing.top;
        }
    }
    return callbackTimes;
}
