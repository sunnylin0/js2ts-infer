import TimingCallbacks from './abc_timing_callbacks';

let timer: TimingCallbacks | undefined;
let cursor: HTMLElement | null;

const animation: any = {};

animation.startAnimation = function(paper: HTMLElement, tune: any, options: any) {
    if (timer) {
        timer.stop();
        timer = undefined;
    }

    if (options.showCursor) {
        cursor = paper.querySelector('.abcjs-cursor') as HTMLElement;
        if (!cursor) {
            cursor = document.createElement('DIV');
            cursor.className = 'abcjs-cursor cursor';
            cursor.style.position = 'absolute';

            paper.appendChild(cursor);
            paper.style.position = 'relative';
        }
    }

    function hideMeasures(elements: NodeListOf<HTMLElement>) {
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            if (!element.classList.contains('abcjs-bar'))
                element.style.display = "none";
        }
    }

    let lastMeasure: string | undefined;
    function disappearMeasuresAfter(selector: string) {
        if (lastMeasure) {
            const elements = paper.querySelectorAll(lastMeasure) as NodeListOf<HTMLElement>;
            hideMeasures(elements);
        }
        lastMeasure = selector;
    }

    function disappearMeasuresBefore(selector: string) {
        const elements = paper.querySelectorAll(selector) as NodeListOf<HTMLElement>;
        hideMeasures(elements);
    }

    function measureCallback(selector: string) {
        if (options.hideCurrentMeasure) {
            disappearMeasuresBefore(selector);
        } else if (options.hideFinishedMeasures) {
            disappearMeasuresAfter(selector);
        }
    }

    function getLineAndMeasure(element: any) {
        return '.abcjs-l' + element.line + '.abcjs-m' + element.measureNumber;
    }

    function setCursor(range: any) {
        if (range) {
            if (range.measureStart) {
                const selector = getLineAndMeasure(range);
                if (selector)
                    measureCallback(selector);
            }
            if (cursor) {
                cursor.style.left = range.left + "px";
                cursor.style.top = range.top + "px";
                cursor.style.width = range.width + "px";
                cursor.style.height = range.height + "px";
            }
        } else {
            if (timer) {
                timer.stop();
                timer = undefined;
            }
        }
    }

    timer = new TimingCallbacks(tune, {
        qpm: options.bpm,
        eventCallback: setCursor
    });
    timer.start();
};

animation.pauseAnimation = function(pause: boolean) {
    if (timer) {
        if (pause)
            timer.pause();
        else
            timer.start();
    }
};

animation.stopAnimation = function() {
    if (timer) {
        timer.stop();
        timer = undefined;
    }
};

export default animation;
