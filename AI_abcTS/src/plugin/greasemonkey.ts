/**
 * abcjs GreaseMonkey Script
 * Meta tags for user scripts
 */
// ==UserScript==
// @name          abcjs
// @namespace     http://code.google.com/p/abcjs
// @description	  This searches any page you load for ABC-formatted music and inserts the standard notation for it.
// ==/UserScript==

// Note: In an ESM environment, these won't be global unless attached to window.
// However, the original logic expected them to be visible to the concatenation.
if (typeof window !== 'undefined') {
	(window as any).abcjs_is_user_script = true;
	
	const scripts = document.getElementsByTagName('script');
	let abcjs_plugin_autostart = true;
	for (let i = 0; i < scripts.length; i++) {
		const src = scripts[i].src;
		if (src.indexOf('abcjs') > 0)
			abcjs_plugin_autostart = false;
	}
	(window as any).abcjs_plugin_autostart = abcjs_plugin_autostart;
}

export const abcjs_is_user_script = true;
