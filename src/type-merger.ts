import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

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

export function mergeDatabases(dbA: any, dbB: any): any {
  const merged = { ...dbA };

  for (const [id, recordB] of Object.entries(dbB) as [string, any][]) {
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
