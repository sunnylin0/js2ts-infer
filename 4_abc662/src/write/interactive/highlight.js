import setClass from '../helpers/set-class';
const highlight = function (klass, color) {
    if (klass === undefined)
        klass = "abcjs-note_selected";
    if (color === undefined)
        color = "#ff0000";
    setClass(this.elemset, klass, "", color);
};
export default highlight;
