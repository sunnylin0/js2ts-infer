import activeAudioContext from './active-audio-context';
export default function supportsAudio(): boolean {
    if (!window.Promise)
        return false;
    if (!window.AudioContext &&
        !window.webkitAudioContext &&
        !navigator.mozAudioContext &&
        !navigator.msAudioContext)
        return false;
    const aac = activeAudioContext();
    if (aac)
        return aac.resume !== undefined;
    return true; // Assume true if we have AudioContext but no aac yet
}
