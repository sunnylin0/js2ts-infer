import activeAudioContext from './active-audio-context';

declare global {
	interface Window {
		AudioContext: typeof AudioContext;
		webkitAudioContext?: typeof AudioContext;
	}
	interface Navigator {
		mozAudioContext?: any;
		msAudioContext?: any;
	}
}

export default function supportsAudio(): boolean {
	if (!window.Promise)
		return false;

	if (!window.AudioContext &&
		!window.webkitAudioContext &&
		!(navigator as any).mozAudioContext &&
		!(navigator as any).msAudioContext)
		return false;

	const aac = activeAudioContext();
	if (aac)
		return aac.resume !== undefined;
	
	return true; // Assume true if we have AudioContext but no aac yet
}
