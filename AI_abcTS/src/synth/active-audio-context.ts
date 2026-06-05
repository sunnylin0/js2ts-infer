import registerAudioContext from './register-audio-context';

declare global {
	interface Window {
		abcjsAudioContext?: AudioContext;
	}
}

export default function activeAudioContext(): AudioContext | undefined {
	if (!window.abcjsAudioContext)
		registerAudioContext();
	return window.abcjsAudioContext;
}
