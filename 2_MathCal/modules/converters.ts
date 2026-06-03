/**
 * 單位轉換核心邏輯模組
 */

import { roundToTwo } from './calculators.js';

interface ConvertStandardFactorsShape {
  m: number;
  cm: number;
  taichi: number;
  taichun: number;
  ft: number;
  in: number;
  [key: string]: any;
}

interface ConvertStandardReturnShape {
  m: string;
  cm: string;
  taichi: string;
  taichun: string;
  ft: string;
  in: string;
  [key: string]: any;
}

interface ConvertTemperatureReturnShape {
  C: string;
  F: string;
  K: string;
  c: string;
  [key: string]: any;
}

interface ConvertAllReturnShape {
  m?: string;
  cm?: string;
  taichi?: string;
  taichun?: string;
  ft?: string;
  in?: string;
  C?: string;
  F?: string;
  K?: string;
  c?: string;
  [key: string]: any;
}

// 長度換算基準（1 公尺 = 其它單位）
const LENGTH_FACTORS = {
  m: 1,
  cm: 100,
  taichi: 3.305785, // 台尺
  taichun: 33.05785, // 台寸
  ft: 3.28084,
  in: 39.37008
};

// 重量換算基準（1 公斤 = 其它單位）
const WEIGHT_FACTORS = {
  kg: 1,
  taichin: 1.666667, // 台斤
  lb: 2.20462,
  oz: 35.27396,
  g: 1000
};

// 面積換算基準（1 平方公尺 = 其它單位）
const AREA_FACTORS = {
  m2: 1,
  cm2: 10000,
  taichi2: 10.9282, // 平方台尺
  taichun2: 1092.82, // 平方台寸
  ft2: 10.7639,
  in2: 1550
};

// 體積換算基準（1 立方公尺 = 其它單位）
const VOLUME_FACTORS = {
  m3: 1,
  cm3: 1000000,
  taichi3: 36.1263, // 立方台尺
  taichun3: 36126.3, // 立方台寸
  ft3: 35.3147,
  in3: 61023.7,
  mm3: 1000000000
};

/**
 * 格式化數值：四捨五入至小數點後第 2 位，若為整數則直接顯示整數
 * @param {number} val 
 * @returns {string}
 */
export function formatConvertedValue(val: number): string {
  if (val === null || isNaN(val)) return '';
  const rounded = roundToTwo(val);
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2);
}

/**
 * 通用基準單位轉換器（單向廣播數據流）
 * @param {Object} factors 單位換算基準表
 * @param {string} fromUnit 來源單位
 * @param {number} value 數值
 * @returns {Object} 轉換後的所有單位數值對照表（值為格式化後的字串）
 */
function convertStandard(factors: ConvertStandardFactorsShape, fromUnit: string, value: number): ConvertStandardReturnShape {
  if (value === null || isNaN(value)) {
    const emptyResult = {};
    Object.keys(factors).forEach(unit => emptyResult[unit] = '');
    return emptyResult;
  }

  // 先轉為基準單位 (Base Unit)
  const baseValue = value / factors[fromUnit];

  // 再由基準單位轉換至所有其他單位
  const result = {};
  Object.keys(factors).forEach(unit => {
    if (unit === fromUnit) {
      result[unit] = formatConvertedValue(value);
    } else {
      const convertedVal = baseValue * factors[unit];
      result[unit] = formatConvertedValue(convertedVal);
    }
  });

  return result;
}

/**
 * 溫度專用轉換器
 * @param {string} fromUnit 來源單位 ('C', 'F', 'K')
 * @param {number} value 數值
 * @returns {Object} { C, F, K }
 */
function convertTemperature(fromUnit: string, value: number): ConvertTemperatureReturnShape {
  const result = { C: '', F: '', K: '' };
  if (value === null || isNaN(value)) return result;

  // 統一先轉成攝氏 (°C)
  let cValue = 0;
  if (fromUnit === 'C') {
    cValue = value;
  } else if (fromUnit === 'F') {
    cValue = (value - 32) * 5 / 9;
  } else if (fromUnit === 'K') {
    cValue = value - 273.15;
  }

  // 再由攝氏轉到其他單位
  result.C = formatConvertedValue(cValue);
  result.F = formatConvertedValue((cValue * 9 / 5) + 32);
  result.K = formatConvertedValue(cValue + 273.15);

  // 確保當前輸入框維持使用者輸入的原樣（避免小數截斷或誤差微調）
  result[fromUnit] = formatConvertedValue(value);

  return result;
}

/**
 * 對外暴露的統一轉換接口
 * @param {string} type 轉換類別 ('length', 'weight', 'area', 'volume', 'temperature')
 * @param {string} fromUnit 來源單位
 * @param {number} value 數值
 * @returns {Object} 該表格所有單位的對照更新表
 */
export function convertAll(type: string, fromUnit: string, value: number): ConvertAllReturnShape {
  if (value === '' || value === null || isNaN(value)) {
    // 空值處理
    const factorsMap = {
      length: LENGTH_FACTORS,
      weight: WEIGHT_FACTORS,
      area: AREA_FACTORS,
      volume: VOLUME_FACTORS
    };
    if (type === 'temperature') {
      return { C: '', F: '', K: '' };
    }
    const factors = factorsMap[type];
    const emptyResult = {};
    if (factors) {
      Object.keys(factors).forEach(u => emptyResult[u] = '');
    }
    return emptyResult;
  }

  const numVal = parseFloat(value);

  // 溫度允許負數，其餘轉換工具不允許負數
  if (type !== 'temperature' && numVal < 0) {
    throw new Error('請輸入大於 0 的有效數值');
  }

  switch (type) {
    case 'length':
      return convertStandard(LENGTH_FACTORS, fromUnit, numVal);
    case 'weight':
      return convertStandard(WEIGHT_FACTORS, fromUnit, numVal);
    case 'area':
      return convertStandard(AREA_FACTORS, fromUnit, numVal);
    case 'volume':
      return convertStandard(VOLUME_FACTORS, fromUnit, numVal);
    case 'temperature':
      return convertTemperature(fromUnit, numVal);
    default:
      throw new Error('未知的轉換類別');
  }
}
