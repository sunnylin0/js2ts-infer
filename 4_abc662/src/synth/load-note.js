import soundsCache from "./sounds-cache";
export default function getNote(url, instrument, name, audioContext) {
    if (!soundsCache[instrument])
        soundsCache[instrument] = {};
    const instrumentCache = soundsCache[instrument];
    if (!instrumentCache[name]) {
        instrumentCache[name] = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const noteUrl = url + instrument + "-mp3/" + name + ".mp3";
            xhr.open("GET", noteUrl, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
                if (xhr.status !== 200) {
                    reject(Error(`Can't load sound at ${noteUrl} status=${xhr.status}`));
                    return;
                }
                const noteDecoded = (audioBuffer) => {
                    resolve({ instrument: instrument, name: name, status: "loaded", audioBuffer: audioBuffer });
                };
                const maybePromise = audioContext.decodeAudioData(xhr.response, noteDecoded, () => {
                    reject(Error(`Can't decode sound at ${noteUrl}`));
                });
                // In older browsers `BaseAudioContext.decodeAudio()` did not return a promise
                if (maybePromise && typeof maybePromise.catch === "function") {
                    maybePromise.catch(reject);
                }
            };
            xhr.onerror = () => {
                reject(Error(`Can't load sound at ${noteUrl}`));
            };
            xhr.send();
        }).catch(err => {
            console.error("Didn't load note", instrument, name, ":", err.message);
            throw err;
        });
    }
    return instrumentCache[name];
}
