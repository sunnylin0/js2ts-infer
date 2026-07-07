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
    window.abcjs_is_user_script = true;
    const scripts: HTMLCollectionOf<HTMLScriptElement> = document.getElementsByTagName('script');
    let abcjs_plugin_autostart: boolean = true;
    for (let i: number = 0; i < scripts.length; i++) {
        const src: string = scripts[i].src;
        if (src.indexOf('abcjs') > 0)
            abcjs_plugin_autostart = false;
    }
    window.abcjs_plugin_autostart = abcjs_plugin_autostart;
}
export const abcjs_is_user_script: boolean = true;
