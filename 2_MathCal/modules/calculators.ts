interface CalculateBMIReturnShape {
  bmi: string;
  category: string;
  colorClass: string;
  percent: number;
  [key: string]: any;
}

interface CalculateAreaParamsShape {
  length?: number;
  width?: number;
  side?: number;
  base?: number;
  height?: number;
  radius?: number;
  [key: string]: any;
}

interface CalculateAreaReturnShape {
  result: string;
  steps: string;
  [key: string]: any;
}

interface CalculateVolumeParamsShape {
  length?: number;
  width?: number;
  height?: number;
  side?: number;
  radius?: number;
  [key: string]: any;
}

interface CalculateVolumeReturnShape {
  result: string;
  steps: string;
  [key: string]: any;
}

/**
 * 數學計算器核心邏輯模組
 */

/**
 * 四捨五入至小數點後第 2 位
 * @param {number} val 
 * @returns {number}
 */
export function roundToTwo(val: (number) | null): number {
  if (isNaN(val) || val === null) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * 計算 BMI
 * 衛福部標準：
 * - 過輕: < 18.5 (藍色)
 * - 正常: 18.5 <= BMI < 24.0 (綠色)
 * - 過重: 24.0 <= BMI < 27.0 (橘色)
 * - 肥胖: BMI >= 27.0 (紅色)
 * 
 * @param {number} heightCm 身高 (公分)
 * @param {number} weightKg 體重 (公斤)
 * @returns {Object} { bmi, category, colorClass, percent }
 */
export function calculateBMI(heightCm: number, weightKg: number): CalculateBMIReturnShape {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) {
    throw new Error('請輸入大於 0 的有效數值');
  }

  const heightM = heightCm / 100;
  const bmiRaw = weightKg / (heightM * heightM);
  const bmi = roundToTwo(bmiRaw);

  let category = '';
  let colorClass = '';
  let percent = 0; // 用於視覺化條的位置 (0-100)

  if (bmi < 18.5) {
    category = '體重過輕';
    colorClass = 'bmi-underweight';
    // 0 ~ 18.5 對應 0% ~ 30%
    percent = Math.min(30, (bmi / 18.5) * 30);
  } else if (bmi >= 18.5 && bmi < 24) {
    category = '正常範圍';
    colorClass = 'bmi-normal';
    // 18.5 ~ 24.0 對應 30% ~ 60%
    percent = 30 + ((bmi - 18.5) / (24 - 18.5)) * 30;
  } else if (bmi >= 24 && bmi < 27) {
    category = '異常過重';
    colorClass = 'bmi-overweight';
    // 24.0 ~ 27.0 對應 60% ~ 80%
    percent = 60 + ((bmi - 24) / (27 - 24)) * 20;
  } else {
    category = '肥胖程度';
    colorClass = 'bmi-obese';
    // 27.0 ~ 40.0 對應 80% ~ 100%
    percent = 80 + Math.min(20, ((bmi - 27) / 13) * 20);
  }

  return {
    bmi: bmi.toFixed(2),
    category,
    colorClass,
    percent: Math.min(100, Math.max(0, roundToTwo(percent)))
  };
}

/**
 * 計算面積
 * @param {string} shape 形狀 ('rectangle', 'square', 'triangle', 'circle')
 * @param {Object} params 參數
 * @returns {Object} { result, steps }
 */
export function calculateArea(shape: string, params: CalculateAreaParamsShape): CalculateAreaReturnShape {
  let result = 0;
  let steps = '';

  switch (shape) {
    case 'rectangle': {
      const { length, width } = params;
      if (length <= 0 || width <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = length * width;
      steps = `公式：長 × 寬 = ${length} × ${width} = ${roundToTwo(result)} m²`;
      break;
    }
    case 'square': {
      const { side } = params;
      if (side <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = side * side;
      steps = `公式：邊長² = ${side}² = ${roundToTwo(result)} m²`;
      break;
    }
    case 'triangle': {
      const { base, height } = params;
      if (base <= 0 || height <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = (base * height) / 2;
      steps = `公式：底 × 高 ÷ 2 = ${base} × ${height} ÷ 2 = ${roundToTwo(result)} m²`;
      break;
    }
    case 'circle': {
      const { radius } = params;
      if (radius <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = Math.PI * radius * radius;
      steps = `公式：π × 半徑² = 3.14159... × ${radius}² = ${roundToTwo(result)} m²`;
      break;
    }
    default:
      throw new Error('未知的形狀類型');
  }

  return {
    result: roundToTwo(result).toFixed(2),
    steps
  };
}

/**
 * 計算體積
 * @param {string} shape 形狀
 * @param {Object} params 參數
 * @returns {Object} { result, steps }
 */
export function calculateVolume(shape: string, params: CalculateVolumeParamsShape): CalculateVolumeReturnShape {
  let result = 0;
  let steps = '';

  switch (shape) {
    case 'cuboid': {
      const { length, width, height } = params;
      if (length <= 0 || width <= 0 || height <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = length * width * height;
      steps = `公式：長 × 寬 × 高 = ${length} × ${width} × ${height} = ${roundToTwo(result)} m³`;
      break;
    }
    case 'cube': {
      const { side } = params;
      if (side <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = side * side * side;
      steps = `公式：邊長³ = ${side}³ = ${roundToTwo(result)} m³`;
      break;
    }
    case 'cylinder': {
      const { radius, height } = params;
      if (radius <= 0 || height <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = Math.PI * radius * radius * height;
      steps = `公式：π × 半徑² × 高 = 3.14159... × ${radius}² × ${height} = ${roundToTwo(result)} m³`;
      break;
    }
    case 'cone': {
      const { radius, height } = params;
      if (radius <= 0 || height <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = (Math.PI * radius * radius * height) / 3;
      steps = `公式：(1/3) × π × 半徑² × 高 = (1/3) × 3.14159... × ${radius}² × ${height} = ${roundToTwo(result)} m³`;
      break;
    }
    case 'sphere': {
      const { radius } = params;
      if (radius <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = (4 / 3) * Math.PI * Math.pow(radius, 3);
      steps = `公式：(4/3) × π × 半徑³ = (4/3) × 3.14159... × ${radius}³ = ${roundToTwo(result)} m³`;
      break;
    }
    case 'prism': {
      const { baseArea, height } = params;
      if (baseArea <= 0 || height <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = baseArea * height;
      steps = `公式：底面積 × 高 = ${baseArea} × ${height} = ${roundToTwo(result)} m³`;
      break;
    }
    case 'pyramid': {
      const { baseArea, height } = params;
      if (baseArea <= 0 || height <= 0) throw new Error('請輸入大於 0 的有效數值');
      result = (baseArea * height) / 3;
      steps = `公式：(1/3) × 底面積 × 高 = (1/3) × ${baseArea} × ${height} = ${roundToTwo(result)} m³`;
      break;
    }
    default:
      throw new Error('未知的形狀類型');
  }

  return {
    result: roundToTwo(result).toFixed(2),
    steps
  };
}
