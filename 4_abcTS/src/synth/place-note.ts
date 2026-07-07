import soundsCache from './sounds-cache';
import pitchToNoteName from './pitch-to-note-name';
import centsToFactor from "./cents-to-factor";
export default function placeNote(outputAudioBuffer, sampleRate, sound, startArray, volumeMultiplier: number, ofsMs, fadeTimeSec: number, noteEndSec: number, debugCallback): Promise<void> | Promise<unknown> | Promise<never> {
    const OfflineAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let len: number = sound.len * sound.tempoMultiplier;
    if (ofsMs)
        len += ofsMs / 1000;
    len -= noteEndSec;
    if (len < 0)
        len = 0.005;
    const offlineCtx: OfflineAC = new OfflineAC(2, Math.floor((len + fadeTimeSec) * sampleRate), sampleRate);
    const noteName = pitchToNoteName[sound.pitch];
    if (!soundsCache[sound.instrument]) {
        if (debugCallback)
            debugCallback('placeNote skipped (instrument empty): ' + sound.instrument + ':' + noteName);
        return Promise.resolve();
    }
    const noteBufferPromise = soundsCache[sound.instrument][noteName];
    if (!noteBufferPromise) {
        if (debugCallback)
            debugCallback('placeNote skipped: ' + sound.instrument + ':' + noteName);
        return Promise.resolve();
    }
    return noteBufferPromise
        .then((response) => {
        const source = offlineCtx.createBufferSource();
        source.buffer = response.audioBuffer;
        const volumesMultiplier: number = (sound.volume / 96) * volumeMultiplier;
        const gainNode = offlineCtx.createGain();
        let panNode;
        if (sound.pan && offlineCtx.createStereoPanner) {
            panNode = offlineCtx.createStereoPanner();
            panNode.pan.setValueAtTime(sound.pan, 0);
        }
        gainNode.gain.value = volumesMultiplier;
        gainNode.gain.linearRampToValueAtTime(gainNode.gain.value, len);
        gainNode.gain.linearRampToValueAtTime(0.0, len + fadeTimeSec);
        if (sound.cents) {
            source.playbackRate.value = centsToFactor(sound.cents);
        }
        if (panNode) {
            panNode.connect(offlineCtx.destination);
            gainNode.connect(panNode);
        }
        else {
            gainNode.connect(offlineCtx.destination);
        }
        source.connect(gainNode);
        source.start(0);
        if (source.noteOff) {
            source.noteOff(len + fadeTimeSec);
        }
        else {
            source.stop(len + fadeTimeSec);
        }
        return new Promise((resolve) => {
            offlineCtx.oncomplete = (e) => {
                if (e.renderedBuffer && e.renderedBuffer.getChannelData) {
                    for (let i: number = 0; i < startArray.length; i++) {
                        let start: number = startArray[i] * sound.tempoMultiplier;
                        if (ofsMs)
                            start -= ofsMs / 1000;
                        if (start < 0)
                            start = 0;
                        const startSample: number = Math.floor(start * sampleRate);
                        copyToChannel(outputAudioBuffer, e.renderedBuffer, startSample);
                    }
                }
                if (debugCallback)
                    debugCallback('placeNote: ' + sound.instrument + ':' + noteName);
                resolve();
            };
            offlineCtx.startRendering();
        });
    })
        .catch((error) => {
        if (debugCallback)
            debugCallback('placeNote catch: ' + error.message);
        return Promise.reject(error);
    });
}
function copyToChannel(toBuffer, fromBuffer, start: number): void {
    for (let ch: number = 0; ch < 2; ch++) {
        const fromData = fromBuffer.getChannelData(ch);
        const toData = toBuffer.getChannelData(ch);
        // Mix the current note into the existing track
        for (let n: number = 0; n < fromData.length; n++) {
            toData[n + start] += fromData[n];
        }
    }
}
