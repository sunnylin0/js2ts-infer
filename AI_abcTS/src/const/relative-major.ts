// All these keys have the same number of accidentals
const keys: { [key: string]: { modes: string[], stepsFromC: number } } = {
	'C': { modes: ['CMaj', 'CIon', 'Amin', 'AAeo', 'Am', 'GMix', 'DDor', 'EPhr', 'FLyd', 'BLoc'], stepsFromC: 0 },
	'Db': { modes: ['DbMaj', 'DbIon', 'Bbmin', 'BbAeo', 'Bbm', 'AbMix', 'EbDor', 'FPhr', 'GbLyd', 'CLoc'], stepsFromC: 1 },
	'D': { modes: ['DMaj', 'DIon', 'Bmin', 'BAeo', 'Bm', 'AMix', 'EDor', 'F#Phr', 'GLyd', 'C#Loc'], stepsFromC: 2 },
	'Eb': { modes: ['EbMaj', 'EbIon', 'Cmin', 'CAeo', 'Cm', 'BbMix', 'FDor', 'GPhr', 'AbLyd', 'DLoc'], stepsFromC: 3 },
	'E': { modes: ['EMaj', 'EIon', 'C#min', 'C#Aeo', 'C#m', 'BMix', 'F#Dor', 'G#Phr', 'ALyd', 'D#Loc'], stepsFromC: 4 },
	'F': { modes: ['FMaj', 'FIon', 'Dmin', 'DAeo', 'Dm', 'CMix', 'GDor', 'APhr', 'BbLyd', 'ELoc'], stepsFromC: 5 },
	'Gb': { modes: ['GbMaj', 'GbIon', 'Ebmin', 'EbAeo', 'Ebm', 'DbMix', 'AbDor', 'BbPhr', 'CbLyd', 'FLoc'], stepsFromC: 6 },
	'G': { modes: ['GMaj', 'GIon', 'Emin', 'EAeo', 'Em', 'DMix', 'ADor', 'BPhr', 'CLyd', 'F#Loc'], stepsFromC: 7 },
	'Ab': { modes: ['AbMaj', 'AbIon', 'Fmin', 'FAeo', 'Fm', 'EbMix', 'BbDor', 'CPhr', 'DbLyd', 'GLoc'], stepsFromC: 8 },
	'A': { modes: ['AMaj', 'AIon', 'F#min', 'F#Aeo', 'F#m', 'EMix', 'BDor', 'C#Phr', 'DLyd', 'G#Loc'], stepsFromC: 9 },
	'Bb': { modes: ['BbMaj', 'BbIon', 'Gmin', 'GAeo', 'Gm', 'FMix', 'CDor', 'DPhr', 'EbLyd', 'ALoc'], stepsFromC: 10 },
	'B': { modes: ['BMaj', 'BIon', 'G#min', 'G#Aeo', 'G#m', 'F#Mix', 'C#Dor', 'D#Phr', 'ELyd', 'A#Loc'], stepsFromC: 11 },
	// Enharmonic keys
	'C#': { modes: ['C#Maj', 'C#Ion', 'A#min', 'A#Aeo', 'A#m', 'G#Mix', 'D#Dor', 'E#Phr', 'F#Lyd', 'B#Loc'], stepsFromC: 1 },
	'F#': { modes: ['F#Maj', 'F#Ion', 'D#min', 'D#Aeo', 'D#m', 'C#Mix', 'G#Dor', 'A#Phr', 'BLyd', 'E#Loc'], stepsFromC: 6 },
	'Cb': { modes: ['CbMaj', 'CbIon', 'Abmin', 'AbAeo', 'Abm', 'GbMix', 'DbDor', 'EbPhr', 'FbLyd', 'BbLoc'], stepsFromC: 11 },
}

const modeNames: string[] = ['maj', 'ion', 'min', 'aeo', 'm', 'mix', 'dor', 'phr', 'lyd', 'loc'];
export function isLegalMode(mode: string) {
	return modeNames.indexOf(mode.toLowerCase()) >= 0
}

let keyReverse: { [key: string]: string } | null = null;

function createKeyReverse() {
	keyReverse = {}
	const allKeys = Object.keys(keys)
	for (let i = 0 ; i < allKeys.length; i++) {
		var keyObj = keys[allKeys[i]]
		keyReverse[allKeys[i].toLowerCase()] = allKeys[i];
		for (var j = 0; j < keyObj.modes.length; j++) {
			var mode = keyObj.modes[j].toLowerCase()
			keyReverse[mode] = allKeys[i];
		}
	}
}

export function relativeMajor(key: string) {
	// Translate a key to its relative major. If it doesn't exist, do the best we can
	// by just returning the original key.
	// There are alternate spellings of these - so the search needs to be case insensitive.
	// To make this efficient, the first time this is called the "keys" object is reversed so this search is fast in the future
	if (!keyReverse) {
		createKeyReverse()
	}
	// get the key portion itself - there might be other stuff, like extra sharps and flats, or the mode written out.
	var mode = key.toLowerCase().match(/([a-g][b#]?)(maj|ion|min|aeo|mix|dor|phr|lyd|loc|m)?/);
	if (!mode || !mode[2])
		return key;
	var modeStr = mode[1] + mode[2]
	var maj = keyReverse![modeStr]
	if (maj)
		return maj;
	return key;
}

export function relativeMode(majorKey: string, mode: string) {
	// The reverse of the relativeMajor. Translate it back to the original mode.
	// If it isn't a recognized mode or it is already major, then just return the major key.
	var group = keys[majorKey]
	if (!group)
		return majorKey;
	if (mode === '')
		return majorKey;
	var match = mode.toLowerCase().match(/^(maj|ion|min|aeo|mix|dor|phr|lyd|loc|m)/);
	if (!match)
		return majorKey
	var regMode = match[1]
	for (var i = 0; i < group.modes.length; i++) {
		var thisMode = group.modes[i]
		var ind = thisMode.toLowerCase().indexOf(regMode)
		if (ind !== -1 && ind === thisMode.length - regMode.length)
			return thisMode.substring(0, thisMode.length - regMode.length)
	}
	return majorKey;
}

export function transposeKey(key: string, steps: number) {
	// This takes a major key and adds the desired steps.
	// It assigns each key a number that is the number of steps from C so that there can just be arithmetic.
	var match = keys[key]
	if (!match)
		return key;
	while (steps < 0) steps += 12;
	var fromC = (match.stepsFromC + steps) % 12;
	for (var i = 0;  i < Object.keys(keys).length; i++) {
		var k = Object.keys(keys)[i]
		if (keys[k].stepsFromC === fromC)
			return k;
	}
	return key;
}

