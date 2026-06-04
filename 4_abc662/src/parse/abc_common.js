// abc_common.ts: Some common utility functions.
const parseCommon = {
    cloneArray: function (source) {
        const destination = [];
        for (let i = 0; i < source.length; i++) {
            destination.push(Object.assign({}, source[i]));
        }
        return destination;
    },
    cloneHashOfHash: function (source) {
        const destination = {};
        for (const property in source) {
            if (Object.prototype.hasOwnProperty.call(source, property)) {
                destination[property] = Object.assign({}, source[property]);
            }
        }
        return destination;
    },
    cloneHashOfArrayOfHash: function (source) {
        const destination = {};
        for (const property in source) {
            if (Object.prototype.hasOwnProperty.call(source, property)) {
                destination[property] = this.cloneArray(source[property]);
            }
        }
        return destination;
    },
    strip: function (str) {
        return str.replace(/^\s+/, '').replace(/\s+$/, '');
    },
    startsWith: function (str, pattern) {
        return str.indexOf(pattern) === 0;
    },
    endsWith: function (str, pattern) {
        const d = str.length - pattern.length;
        return d >= 0 && str.lastIndexOf(pattern) === d;
    },
    last: function (arr) {
        if (arr.length === 0)
            return null;
        return arr[arr.length - 1];
    }
};
export default parseCommon;
