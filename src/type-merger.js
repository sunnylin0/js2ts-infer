const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// 合併單個型別描述值 (可能為字串如 "string", 或物件 shape)
function mergeSingleVal(v1, v2) {
  if (v1 === v2) return v1;
  if (!v1) return v2;
  if (!v2) return v1;

  const isObj1 = typeof v1 === 'object';
  const isObj2 = typeof v2 === 'object';

  if (isObj1 && isObj2) {
    return mergeTwoShapes(v1, v2);
  }

  // 若一個是物件，一個是基本型別，例如 Shape 與 undefined/null/string
  // 我們可以將其合併為 Union 字串形式，或者將其規格化。
  // 為了處理 "Shape | null | undefined" 的聯集，如果其中一個是物件，另一個是基本型別：
  // 我們可以把 basic type 合併到 union 中。例如：
  // 傳回一個包含物件 Shape 與基本型別的聯集結構
  // 但在 types-observed.json 合約中：
  // "observedTypes" 儲存基本型別，"objectShapes" 儲存複雜物件的結構
  // 如果我們遇到物件與基本型別混用，例如 `param` 可能是 `{ id: string }` 或者是 `null`：
  // 則 `{ id: string }` 會出現在 `objectShapes`，而 `"null"` 會出現在 `observedTypes`
  // 這是完美的！這意味著在 tracker-client 中，`observedTypes` 和 `objectShapes` 已經天然分開了。
  // 這裡 mergeSingleVal 通常是用於合併巢狀物件的屬性值。
  // 在巢狀物件屬性值中，如果一個屬性既可以是 `{ subId: string }` 又可以是 `null`，該怎麼辦？
  // 我們可以讓屬性值也是一個 "Union" 表示。例如以字串表示為 `"{ subId: string } | null"`。
  // 或者是簡化為 `"any"`，或者用字串聯集表示。
  // 為了解決這個問題，我們可以支援屬性值為字串聯集，如 `"null | object"`。
  // 讓我們設計：若一邊是物件，一邊是基本型別，則將物件轉為簡化的 `'object'` 或將基本型別與物件合併為字串：
  if (isObj1) {
    if (v2 === 'null' || v2 === 'undefined') {
      // 依然是物件，但可為 null/undefined。我們可以在後續處理中將其視為 nullable 物件
      return { ...v1, __nullable: true }; // 標記為可空物件
    }
    return 'any';
  }
  if (isObj2) {
    if (v1 === 'null' || v1 === 'undefined') {
      return { ...v2, __nullable: true };
    }
    return 'any';
  }

  // 兩者皆為基本型別字串
  // 合併聯集，例如 "string" 與 "number" -> "string | number"
  const parts1 = v1.split(' | ');
  const parts2 = v2.split(' | ');
  const mergedParts = Array.from(new Set([...parts1, ...parts2]));
  return mergedParts.join(' | ');
}

// 合併兩個 Plain Object Shapes
function mergeTwoShapes(s1, s2) {
  const result = {};
  
  // 保留 __nullable 標記
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

// 合併兩份 typeDB 的主要函數
function mergeDatabases(dbA, dbB) {
  const merged = { ...dbA };

  for (const [id, recordB] of Object.entries(dbB)) {
    if (!merged[id]) {
      // 若 B 有而 A 沒有，直接深拷貝
      merged[id] = {
        observedTypes: [...(recordB.observedTypes || [])],
        objectShapes: recordB.objectShapes ? JSON.parse(JSON.stringify(recordB.objectShapes)) : [],
        callCount: recordB.callCount || 0
      };
      continue;
    }

    const recordA = merged[id];
    recordA.callCount = (recordA.callCount || 0) + (recordB.callCount || 0);

    // 合併 observedTypes (基本型別)
    const typesSet = new Set([...(recordA.observedTypes || []), ...(recordB.observedTypes || [])]);
    recordA.observedTypes = Array.from(typesSet);

    // 合併 objectShapes
    if (recordB.objectShapes && recordB.objectShapes.length > 0) {
      if (!recordA.objectShapes) recordA.objectShapes = [];
      
      // 我們把 B 的 shapes 合併到 A 中
      recordB.objectShapes.forEach(shapeB => {
        // 如果 A 中已有非常相似的 shape，則將它們融合成一個
        let mergedIntoExisting = false;
        for (let i = 0; i < recordA.objectShapes.length; i++) {
          const shapeA = recordA.objectShapes[i];
          
          // 判斷鍵值的交集程度，若結構相似度高，則合併為一個
          const keysA = Object.keys(shapeA).filter(k => k !== '__nullable');
          const keysB = Object.keys(shapeB).filter(k => k !== '__nullable');
          
          // 簡單規則：若屬性重疊率大於 50%，就將其融合合併
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

module.exports = {
  mergeDatabases,
  mergeTwoShapes,
  mergeSingleVal
};
