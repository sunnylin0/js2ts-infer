import setClass from '../helpers/set-class';
const unhighlight = function (klass, color) {
    if (klass === undefined)
        klass = "abcjs-note_selected";
    if (color === undefined)
        color = "#000000";
    setClass(this.elemset, "", klass, color);
};
export default unhighlight;
