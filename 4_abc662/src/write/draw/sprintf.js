/**
 * sprintf() for JavaScript v.0.4
 *
 Copyright (c) 2007-present, Alexandru Mărășteanu <hello@alexei.ro>
 All rights reserved.
 */
function str_repeat(i, m) {
    for (var o = []; m > 0; m--) {
        o.push(i);
    }
    return o.join('');
}
const sprintf = function (...args) {
    let i = 0;
    let f = args[i++];
    let o = [];
    let m;
    let a, p, c, x;
    while (f) {
        if (m = /^[^\x25]+/.exec(f)) {
            o.push(m[0]);
        }
        else if (m = /^\x25{2}/.exec(f)) {
            o.push('%');
        }
        else if (m = /^\x25(?:(\d+)\$)?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(f)) {
            if (((a = args[m[1] || i++]) == null) || (a == undefined)) {
                throw ("Too few arguments.");
            }
            if (/[^s]/.test(m[7]) && (typeof (a) != 'number')) {
                throw ("Expecting number but found " + typeof (a));
            }
            switch (m[7]) {
                case 'b':
                    a = a.toString(2);
                    break;
                case 'c':
                    a = String.fromCharCode(a);
                    break;
                case 'd':
                    a = parseInt(a);
                    break;
                case 'e':
                    a = m[6] ? a.toExponential(parseInt(m[6])) : a.toExponential();
                    break;
                case 'f':
                    a = m[6] ? parseFloat(a).toFixed(parseInt(m[6])) : parseFloat(a);
                    break;
                case 'o':
                    a = a.toString(8);
                    break;
                case 's':
                    a = ((a = String(a)) && m[6] ? a.substring(0, parseInt(m[6])) : a);
                    break;
                case 'u':
                    a = Math.abs(a);
                    break;
                case 'x':
                    a = a.toString(16);
                    break;
                case 'X':
                    a = a.toString(16).toUpperCase();
                    break;
            }
            a = (/[def]/.test(m[7]) && m[2] && a > 0 ? '+' + a : a);
            c = m[3] ? m[3] == '0' ? '0' : m[3][1] : ' ';
            x = m[5] ? parseInt(m[5]) - String(a).length : 0;
            p = m[5] ? str_repeat(c, x) : '';
            o.push(m[4] ? a + p : p + a);
        }
        else {
            throw ("Huh ?!");
        }
        f = f.substring(m[0].length);
    }
    return o.join('');
};
export default sprintf;
