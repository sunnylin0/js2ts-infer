// abc_common.ts: Some common utility functions.

const parseCommon = {
	cloneArray: function <T>(source: T[]): T[] {
		const destination: T[] = [];
		for (let i = 0; i < source.length; i++) {
			destination.push(Object.assign({}, source[i]));
		}
		return destination;
	},

	cloneHashOfHash: function <T>(source: Record<string, T>): Record<string, T> {
		const destination: Record<string, T> = {} as Record<string, T>;
		for (const property in source) {
			if (Object.prototype.hasOwnProperty.call(source, property)) {
				destination[property] = Object.assign({}, source[property]);
			}
		}
		return destination;
	},

	cloneHashOfArrayOfHash: function <T>(source: Record<string, T[]>): Record<string, T[]> {
		const destination: Record<string, T[]> = {} as Record<string, T[]>;
		for (const property in source) {
			if (Object.prototype.hasOwnProperty.call(source, property)) {
				destination[property] = this.cloneArray(source[property]);
			}
		}
		return destination;
	},

	strip: function (str: string): string {
		return str.replace(/^\s+/, '').replace(/\s+$/, '');
	},

	startsWith: function (str: string, pattern: string): boolean {
		return str.indexOf(pattern) === 0;
	},

	endsWith: function (str: string, pattern: string): boolean {
		const d = str.length - pattern.length;
		return d >= 0 && str.lastIndexOf(pattern) === d;
	},

	last: function <T>(arr: T[]): T | null {
		if (arr.length === 0)
			return null;
		return arr[arr.length - 1];
	}
};

export default parseCommon;
