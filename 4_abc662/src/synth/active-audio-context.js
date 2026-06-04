import registerAudioContext from './register-audio-context';
export default function activeAudioContext() {
    if (!window.abcjsAudioContext)
        registerAudioContext();
    return window.abcjsAudioContext;
}
