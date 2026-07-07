export default function registerAudioContext(ac): boolean {
    if (ac)
        window.abcjsAudioContext = ac;
    else {
        if (!window.abcjsAudioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass)
                window.abcjsAudioContext = new AudioContextClass();
            else
                return false;
        }
    }
    return window.abcjsAudioContext ? window.abcjsAudioContext.state !== "suspended" : false;
}
