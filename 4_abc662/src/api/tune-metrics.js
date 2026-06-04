import tunebook from './abc_tunebook';
import EngraverController from '../write/engraver-controller';
var tuneMetrics = function (abc, params) {
    function callback(div, tune, tuneNumber, abcString) {
        div = document.createElement("div");
        div.setAttribute("style", "visibility: hidden;");
        document.body.appendChild(div);
        var engraver_controller = new EngraverController(div, params);
        var widths = engraver_controller.getMeasureWidths(tune);
        div.parentNode.removeChild(div);
        return { sections: widths };
    }
    return tunebook.renderEngine(callback, "*", abc, params);
};
export default tuneMetrics;
