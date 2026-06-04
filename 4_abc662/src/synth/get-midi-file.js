import tunebook from '../api/abc_tunebook';
// @ts-ignore
import midiCreate from '../midi/abc_midi_create';
export default function getMidiFile(source, options) {
    const params = Object.assign({}, options);
    params.generateInline = false;
    const callback = (div, tune, index) => {
        const downloadMidi = midiCreate(tune, params);
        switch (params.midiOutputType) {
            case "encoded":
                return downloadMidi;
            case "binary":
                let decoded = downloadMidi.replace("data:audio/midi,", "");
                decoded = decoded.replace(/MThd/g, "%4d%54%68%64");
                decoded = decoded.replace(/MTrk/g, "%4d%54%72%6b");
                const output = new Uint8Array(decoded.length / 3);
                for (let i = 0; i < decoded.length / 3; i++) {
                    const p = i * 3 + 1;
                    const d = parseInt(decoded.substring(p, p + 2), 16);
                    output[i] = d;
                }
                return output;
            case "link":
            default:
                return generateMidiDownloadLink(tune, params, downloadMidi, index);
        }
    };
    if (typeof source === "string")
        return tunebook.renderEngine(callback, "*", source, params);
    else
        return callback(null, source, 0);
}
function generateMidiDownloadLink(tune, midiParams, midi, index) {
    const divClasses = ['abcjs-download-midi', `abcjs-midi-${index}`];
    if (midiParams.downloadClass)
        divClasses.push(midiParams.downloadClass);
    let html = `<div class="${divClasses.join(' ')}">`;
    if (midiParams.preTextDownload)
        html += midiParams.preTextDownload;
    const title = tune.metaText && tune.metaText.title ? tune.metaText.title : 'Untitled';
    let label;
    if (midiParams.downloadLabel && typeof midiParams.downloadLabel === 'function')
        label = midiParams.downloadLabel(tune, index);
    else if (midiParams.downloadLabel)
        label = midiParams.downloadLabel.replace(/%T/g, title);
    else
        label = `Download MIDI for "${title}"`;
    const sanitizedTitle = title.toLowerCase().replace(/'/g, '').replace(/\W/g, '_').replace(/__/g, '_');
    const filename = (midiParams.fileName) ? midiParams.fileName : sanitizedTitle + '.midi';
    html += `<a download="${filename}" href="${midi}">${label}</a>`;
    if (midiParams.postTextDownload)
        html += midiParams.postTextDownload;
    return html + "</div>";
}
