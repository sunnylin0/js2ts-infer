import { roundToTwo, calculateBMI, calculateArea, calculateVolume } from './modules/calculators.js';
import { convertAll } from './modules/converters.js';

console.log('🧪 執行 MathCal 動態測試流程...');

// 呼叫各式運算以覆蓋程式碼路徑並側錄型別
roundToTwo(10.555);
roundToTwo(null);

try { calculateBMI(175, 70); } catch (e) {}
try { calculateBMI(0, 0); } catch (e) {}

try { calculateArea('rectangle', { length: 10, width: 5 }); } catch (e) {}
try { calculateArea('square', { side: 4 }); } catch (e) {}
try { calculateArea('triangle', { base: 6, height: 8 }); } catch (e) {}
try { calculateArea('circle', { radius: 3 }); } catch (e) {}

try { calculateVolume('cuboid', { length: 2, width: 3, height: 4 }); } catch (e) {}
try { calculateVolume('cube', { side: 5 }); } catch (e) {}
try { calculateVolume('cylinder', { radius: 3, height: 5 }); } catch (e) {}

try { convertAll('length', 'm', 100); } catch (e) {}
try { convertAll('temperature', 'c', 25); } catch (e) {}

console.log('🧪 測試流程執行完畢。');
