import soundsCache from "./sounds-cache";

export interface NoteResponse {
    instrument: string;
    name: string;
    status: "loaded" | "pending" | "cached" | "error";
    audioBuffer?: AudioBuffer;
    message?: string;
}

export default function getNote(url: string, instrument: string, name: string, audioContext: AudioContext): Promise<NoteResponse> {
    if (!soundsCache[instrument]) soundsCache[instrument] = {};
    const instrumentCache = soundsCache[instrument];

    if (!instrumentCache[name]) {
        instrumentCache[name] = new Promise<NoteResponse>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const noteUrl = url + instrument + "-mp3/" + name + ".mp3";
            xhr.open("GET", noteUrl, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
                if (xhr.status !== 200) {
                    reject(Error(`Can't load sound at ${noteUrl} status=${xhr.status}`));
                    return;
                }
                const noteDecoded = (audioBuffer: AudioBuffer) => {
                    resolve({ instrument: instrument, name: name, status: "loaded", audioBuffer: audioBuffer });
                };
                const maybePromise = audioContext.decodeAudioData(xhr.response, noteDecoded, () => {
                    reject(Error(`Can't decode sound at ${noteUrl}`));
                });
                // In older browsers `BaseAudioContext.decodeAudio()` did not return a promise
                if (maybePromise && typeof (maybePromise as any).catch === "function") {
                    (maybePromise as any).catch(reject);
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
