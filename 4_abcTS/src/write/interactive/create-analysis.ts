/**
 * 這個函式負責檢查單一個類別名稱，如果符合特定的前綴，就把後面的文字轉成數字。
 * @param klass
 * @param match
 * @param target
 * @param name
 */
function findNumber(klass, match: string, target, name: string): void {
  if (klass.indexOf(match) === 0) {
    const value = klass.replace(match, '');
    const num: number = parseInt(value, 10);
    if ('' + num === value)
      target[name] = num;
  }
}
function createAnalysis(target, ev) {
  const classes = [];
  if (target.absEl && target.absEl.elemset) {
    const classObj: {} = {};
    for (let j: number = 0; j < target.absEl.elemset.length; j++) {
      const es = target.absEl.elemset[j];
      if (es) {
        const klassAttr = es.getAttribute("class");
        if (klassAttr) {
          const klass = klassAttr.split(' ');
          for (let k: number = 0; k < klass.length; k++)
            classObj[klass[k]] = true;
        }
      }
    }
    const keys: string[] = Object.keys(classObj);
    for (let kk: number = 0; kk < keys.length; kk++)
      classes.push(keys[kk]);
  }
  const analysis: {} = {};
  for (let ii: number = 0; ii < classes.length; ii++) {
    // 假設目前的 class 是 "abcjs-v2" -> 匹配成功，analysis.voice = 2
    // 假設目前的 class 是 "abcjs-l0" -> 匹配成功，analysis.line = 0
    // 假設目前的 class 是 "abcjs-m4" -> 匹配成功，analysis.measure = 4
    findNumber(classes[ii], "abcjs-v", analysis, "voice");
    findNumber(classes[ii], "abcjs-l", analysis, "line");
    findNumber(classes[ii], "abcjs-m", analysis, "measure");
  }
  if (target.staffPos)
    analysis.staffPos = target.staffPos;
  let closest = ev.target;
  while (closest && closest.dataset && !closest.dataset.name && closest.tagName.toLowerCase() !== 'svg')
    closest = closest.parentNode;
  let parent = ev.target;
  while (parent && parent.dataset && !parent.dataset.index && parent.tagName.toLowerCase() !== 'svg')
    parent = parent.parentNode;
  if (parent && parent.dataset) {
    analysis.name = parent.dataset.name;
    analysis.clickedName = closest ? closest.dataset.name : undefined;
    analysis.parentClasses = parent.classList;
  }
  if (closest && closest.classList)
    analysis.clickedClasses = closest.classList;
  analysis.selectableElement = target.svgEl;
  return { classes: classes, analysis: analysis };
}
export default createAnalysis;
