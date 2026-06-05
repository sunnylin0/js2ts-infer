import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

/**
 * 合併兩個型別值，推導出聯集或寬化後的結果。
 * 
 * @description
 * 1. 若兩者完全相同，直接回傳。
 * 2. 若其中一個為空，回傳另一個。
 * 3. 若皆為物件結構，呼叫 `mergeTwoShapes` 深度合併物件。
 * 4. 若其中一者為物件而另一者為 null/undefined，則為物件加上 `__nullable = true`。
 * 5. 若皆為字串型別，以 ` | ` 符號分割並進行聯集去重合併。
 * 
 * @param {any} v1 - 第一個型別值（字串或物件結構）。
 * @param {any} v2 - 第二個型別值（字串或物件結構）。
 * @returns {any} 合併後的聯集合成型別。
 */
export function mergeSingleVal(v1: any, v2: any): any {
  if (v1 === v2) return v1;
  if (!v1) return v2;
  if (!v2) return v1;

  const isObj1 = typeof v1 === 'object';
  const isObj2 = typeof v2 === 'object';

  if (isObj1 && isObj2) {
    return mergeTwoShapes(v1, v2);
  }

  if (isObj1) {
    if (v2 === 'null' || v2 === 'undefined') {
      return { ...v1, __nullable: true };
    }
    return 'any';
  }
  if (isObj2) {
    if (v1 === 'null' || v1 === 'undefined') {
      return { ...v2, __nullable: true };
    }
    return 'any';
  }

  const parts1 = v1.split(' | ');
  const parts2 = v2.split(' | ');
  const mergedParts = Array.from(new Set([...parts1, ...parts2]));
  return mergedParts.join(' | ');
}

/**
 * 深度合併兩個物件字面量（Shape）結構。
 * 
 * @description
 * 取得兩個 Shape 的所有鍵名聯集。針對每一個鍵，
 * 取得各自對應的型別並呼叫 `mergeSingleVal` 進行深度合併。
 * 若某個鍵僅在其中一個 Shape 中出現，則視為可選屬性並與 `'undefined'` 進行合併。
 * 
 * @param {any} s1 - 第一個物件字面量 Shape 結構。
 * @param {any} s2 - 第二個物件字面量 Shape 結構。
 * @returns {any} 合併後包含可選與 nullable 標記的新 Shape 結構。
 */
export function mergeTwoShapes(s1: any, s2: any): any {
  const result: any = {};
  
  if (s1.__nullable || s2.__nullable) {
    result.__nullable = true;
  }

  const keys1 = Object.keys(s1).filter(k => k !== '__nullable');
  const keys2 = Object.keys(s2).filter(k => k !== '__nullable');
  
  const allKeys = new Set([...keys1, ...keys2]);
  for (const key of allKeys) {
    const val1 = s1[key];
    const val2 = s2[key];
    if (val1 !== undefined && val2 !== undefined) {
      result[key] = mergeSingleVal(val1, val2);
    } else if (val1 !== undefined) {
      result[key] = mergeSingleVal(val1, 'undefined');
    } else {
      result[key] = mergeSingleVal(val2, 'undefined');
    }
  }
  return result;
}

/**
 * 合併兩個完整的型別資料庫（dbA 與 dbB）。
 * 
 * @description
 * 1. 合併與加總靜態/動態呼叫關係鏈 `__callGraph` 的權重。
 * 2. 遍歷 dbB 中的所有型別側錄記錄點 ID。
 *    a. 若 dbA 中不存在此 ID，直接複製。
 *    b. 若 dbA 已存在此 ID，加總 `callCount`、聯集合併並去重 `observedTypes`。
 *    c. 比對兩者的物件結構（objectShapes）。若結構相似度大於等於 50%，則將兩者合併；否則作為獨立的物件結構加入清單中。
 * 
 * @param {any} dbA - 原有的型別資料庫物件。
 * @param {any} dbB - 欲併入的新型別資料庫物件。
 * @returns {any} 合併後去重與寬化完成的新型別資料庫。
 */
export function mergeDatabases(dbA: any, dbB: any): any {
  const merged = { ...dbA };

  if (dbB.__callGraph || dbA.__callGraph) {
    const graphA = dbA.__callGraph ? dbA.__callGraph.graph : {};
    const graphB = dbB.__callGraph ? dbB.__callGraph.graph : {};
    const mergedGraph = { ...graphA };
    for (const [caller, callees] of Object.entries(graphB)) {
      if (!mergedGraph[caller]) {
        mergedGraph[caller] = {};
      }
      for (const [callee, count] of Object.entries(callees as Record<string, number>)) {
        mergedGraph[caller][callee] = (mergedGraph[caller][callee] || 0) + count;
      }
    }
    merged.__callGraph = {
      graph: mergedGraph
    };
  }

  for (const [id, recordB] of Object.entries(dbB) as [string, any][]) {
    if (id === '__callGraph') continue;
    if (!merged[id]) {
      merged[id] = {
        observedTypes: [...(recordB.observedTypes || [])],
        objectShapes: recordB.objectShapes ? JSON.parse(JSON.stringify(recordB.objectShapes)) : [],
        callCount: recordB.callCount || 0
      };
      continue;
    }

    const recordA = merged[id];
    recordA.callCount = (recordA.callCount || 0) + (recordB.callCount || 0);

    const typesSet = new Set([...(recordA.observedTypes || []), ...(recordB.observedTypes || [])]);
    recordA.observedTypes = Array.from(typesSet);

    if (recordB.objectShapes && recordB.objectShapes.length > 0) {
      if (!recordA.objectShapes) recordA.objectShapes = [];
      
      recordB.objectShapes.forEach((shapeB: any) => {
        let mergedIntoExisting = false;
        for (let i = 0; i < recordA.objectShapes.length; i++) {
          const shapeA = recordA.objectShapes[i];
          
          const keysA = Object.keys(shapeA).filter(k => k !== '__nullable');
          const keysB = Object.keys(shapeB).filter(k => k !== '__nullable');
          
          const overlap = keysA.filter(k => keysB.includes(k));
          const maxKeys = Math.max(keysA.length, keysB.length);
          
          if (maxKeys === 0 || (overlap.length / maxKeys) >= 0.5) {
            recordA.objectShapes[i] = mergeTwoShapes(shapeA, shapeB);
            mergedIntoExisting = true;
            break;
          }
        }

        if (!mergedIntoExisting) {
          recordA.objectShapes.push(JSON.parse(JSON.stringify(shapeB)));
        }
      });
    }
  }

  return merged;
}
