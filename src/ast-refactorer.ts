import * as fs from 'fs';
import * as path from 'path';
import { Project, SyntaxKind, SourceFile, TypeChecker, VariableDeclarationKind, ts, Node } from 'ts-morph';

// override require cache for typescript to prevent ts-morph version mismatch
try {
  require.cache[require.resolve('typescript')] = {
    exports: ts
  } as any;
} catch (e) {}

import { tsquery } from '@phenomnomnominal/tsquery';
import { mergeSingleVal } from './type-merger';

declare module 'ts-morph' {
  interface Node {
    query(selector: string): any[];
  }
}

// Extend Node prototype
(Node.prototype as any).query = function (this: Node, selector: string): any[] {
  const compilerNode = this.compilerNode || this;
  const sourceFile = this.getSourceFile();
  const matches = tsquery(compilerNode as any, selector);
  return matches.map(n => 
    (sourceFile as any)._context.compilerFactory.getNodeFromCompilerNode(n, sourceFile)
  );
};

/**
 * 輔助函式：使用 tsquery 查詢 AST 節點，並自動將匹配到的 ts.Node 包裝為 ts-morph Node 物件。
 */
function query(node: any, selector: string): any[] {
  return node.query(selector);
}

/**
 * 合併一個物件字面量 Shape 的陣列，計算出合併後單一寬化 Shape。
 * 
 * @description
 * 遍歷所有傳入的 Shape，將相同的欄位名進行歸納，並透過 `mergeSingleVal` 對其型別進行寬化。
 * 若某個欄位在部分 Shape 中缺失，則自動將該欄位標記為含有 `undefined` 的可選屬性。
 * 
 * @param {any[]} shapes - 包含多個物件結構 (Shape) 的陣列。
 * @returns {any} 返回合併寬化後的單一 Shape 物件結構。
 */
function mergeObjectShapesArray(shapes: any[]): any {
  if (shapes.length === 0) return {};
  if (shapes.length === 1) return shapes[0];

  const combined: any = {};

  const allKeys = new Set<string>();
  shapes.forEach(s => {
    Object.keys(s).filter(k => k !== '__nullable').forEach(k => allKeys.add(k));
  });

  for (const key of allKeys) {
    let existCount = 0;
    const valTypes: any[] = [];

    shapes.forEach(s => {
      if (s[key] !== undefined) {
        existCount++;
        valTypes.push(s[key]);
      }
    });

    let mergedVal = 'any';
    if (valTypes.length > 0) {
      mergedVal = valTypes.reduce((acc, curr) => mergeSingleVal(acc, curr));
    }

    if (existCount < shapes.length) {
      mergedVal = mergeSingleVal(mergedVal, 'undefined');
    }

    combined[key] = mergedVal;
  }

  if (shapes.some(s => s.__nullable)) {
    combined.__nullable = true;
  }

  return combined;
}

/**
 * 格式化介面或物件字面量的 Key 名稱。
 * 
 * @description
 * 若 Key 包含特殊字元或不符合變數命名規範，則將其使用 JSON.stringify 進行引號包裹。
 * 
 * @param {string} key - 原始 Key 欄位名稱。
 * @returns {string} 格式化後的 Key 字串。
 */
function formatInterfaceKey(key: string): string {
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return key;
  }
  return JSON.stringify(key);
}

/**
 * 將物件字面量 Shape 遞迴轉換為 TypeScript Interface 的主體程式碼字串。
 * 
 * @description
 * 遍歷 Shape 物件，逐個屬性將型別寫為 `key: type;`。若屬性為嵌套物件，遞迴呼叫本函數處理。
 * 若屬性包含 `undefined`，將其設為可選屬性 `key?: type;`。
 * 並於末尾統一追加 `[key: string]: any;` 索引簽名以增加型別相容性。
 * 
 * @param {any} shape - 包含欄位型別映射的 Shape 結構。
 * @param {number} [depth=1] - 目前嵌套遞迴的深度，用於縮排排版。
 * @returns {string} Interface 內部的成員定義程式碼。
 */
function shapeToInterfaceBody(shape: any, depth = 1): string {
  const indent = '  '.repeat(depth);
  let body = '';

  for (const [key, typeVal] of Object.entries(shape)) {
    if (key === '__nullable') continue;

    let isOptional = false;
    let finalType = 'any';

    if (typeof typeVal === 'object') {
      const subBody = shapeToInterfaceBody(typeVal, depth + 1);
      finalType = `{\n${subBody}${'  '.repeat(depth)}}`;
      if ((typeVal as any).__nullable) {
        finalType += ' | null';
      }
    } else {
      let typeStr = typeVal as string;
      const parts = typeStr.split(' | ');
      if (parts.includes('undefined')) {
        isOptional = true;
        typeStr = parts.filter(p => p !== 'undefined').join(' | ') || 'any';
      }
      finalType = typeStr;
    }

    const formattedKey = formatInterfaceKey(key);
    body += `${indent}${formattedKey}${isOptional ? '?' : ''}: ${finalType};\n`;
  }

  body += `${indent}[key: string]: any;\n`;
  return body;
}

/**
 * 在專案中尋找與當前 Shape 結構特徵相符的既有 Interface 名稱。
 * 
 * @description
 * 避免生成重複冗餘的 `*Shape` 介面。遍歷專案中所有的介面定義，
 * 比對其屬性鍵名是否能 100% 覆蓋當前 Shape 的鍵名（至少大於等於 2 個欄位符合）。
 * 若有，則直接復用既有 Interface。
 * 
 * @param {Project} project - ts-morph Project 專案實例。
 * @param {any} shape - 欲進行比對的 Shape 結構。
 * @returns {string|null} 匹配到的 Interface 名稱，若無則返回 `null`。
 */
function findMatchingInterface(project: Project, shape: any): string | null {
  const shapeKeys = Object.keys(shape).filter(k => k !== '__nullable');
  if (shapeKeys.length === 0) return null;

  for (const sourceFile of project.getSourceFiles()) {
    const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
    for (const iface of interfaces) {
      const ifaceName = iface.getName();
      if (ifaceName.endsWith('Shape')) continue;

      const ifaceProps = iface.getProperties();
      const ifacePropNames = new Set(ifaceProps.map(p => p.getName()));

      let matchCount = 0;
      for (const key of shapeKeys) {
        if (ifacePropNames.has(key)) {
          matchCount++;
        }
      }

      if (matchCount === shapeKeys.length && shapeKeys.length >= 2) {
        return ifaceName;
      }
    }
  }
  return null;
}

/**
 * 將特定字面量型別寬化為對應的 TypeScript 基礎型別。
 * 
 * @description
 * 1. `'true'` 或 `'false'` 寬化為 `'boolean'`。
 * 2. 數值字串寬化為 `'number'`。
 * 3. 各式引號包裹的字串寬化為 `'string'`。
 * 4. 支援聯集型別（` | `）的分割遞迴寬化。
 * 
 * @param {string} t - 原始的字面量型別字串（如 `"abc"`, `42` 等）。
 * @returns {string} 寬化後的基礎型別字串（如 `string`, `number` 等）。
 */
function widenTypeName(t: string): string {
  if (t.includes(' | ')) {
    const parts = t.split(' | ').map(p => widenTypeName(p));
    return Array.from(new Set(parts)).join(' | ');
  }
  const clean = t.trim();
  if (clean === 'true' || clean === 'false') {
    return 'boolean';
  }
  if (!clean) return t;
  if (!isNaN(Number(clean))) {
    return 'number';
  }
  if ((clean.startsWith('"') && clean.endsWith('"')) || 
      (clean.startsWith("'") && clean.endsWith("'")) || 
      (clean.startsWith("`") && clean.endsWith("`"))) {
    return 'string';
  }
  return t;
}

/**
 * 依據側錄記錄與現有 d.ts 規則解析並推導出最合適的參數型別字串。
 * 
 * @description
 * 1. 提取 basic types 與 objectShapes。
 * 2. 針對基礎型別執行 `widenTypeName` 寬化基礎型別。
 * 3. 針對物件 Shape 呼叫 `findMatchingInterface` 尋找既有介面；若無則自動生成新的 `*Shape` 並暫存。
 * 4. 處理可為 null 或是 undefined 的聯集型別，並對 `[object Object]` 進行安全過濾。
 * 
 * @param {any} record - 從 typeDB 取得的單一參數側錄記錄點。
 * @param {string} baseName - 用於自動生成 Interface 名稱的前綴底標。
 * @param {Record<string, string>} interfacesToDeclare - 用於收集待寫入 Interface 的暫存映射物件。
 * @param {Project} [project] - ts-morph Project 專案實例。
 * @returns {string} 推導出的 TypeScript 參數型別定義字串。
 */
function resolveParameterType(record: any, baseName: string, interfacesToDeclare: Record<string, string>, project?: Project): string {
  const observedTypes = record.observedTypes || [];
  const objectShapes = record.objectShapes || [];

  const isNullable = observedTypes.includes('null');
  const isUndefined = observedTypes.includes('undefined');

  const cleanBasicTypes = observedTypes
    .filter((t: string) => t !== 'null' && t !== 'undefined')
    .map((t: string) => widenTypeName(t));
  let typeNames = Array.from(new Set(cleanBasicTypes));

  if (objectShapes.length > 0) {
    const combinedShape = mergeObjectShapesArray(objectShapes);
    let matchedInterface: string | null = null;
    if (project) {
      matchedInterface = findMatchingInterface(project, combinedShape);
    }

    if (matchedInterface) {
      typeNames.push(matchedInterface);
    } else {
      const interfaceName = `${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}Shape`;
      const body = shapeToInterfaceBody(combinedShape);
      const declaration = `interface ${interfaceName} {\n${body}}`;

      interfacesToDeclare[interfaceName] = declaration;
      typeNames.push(interfaceName);
    }
  }

  if (typeNames.length === 0) {
    if (isNullable) return 'null';
    if (isUndefined) return 'undefined';
    return 'any';
  }

  let finalType = typeNames.join(' | ');
  if (isNullable) {
    finalType = `(${finalType}) | null`;
  }

  let result = finalType.replace(/\[object Object\]/g, '{ [key: string]: any }');
  while (result.includes('<>')) {
    result = result.replace(/<>/g, '<any>');
  }
  return result;
}

/**
 * 取得乾淨、可用於重構的變數或回傳值型別字串。
 * 
 * @description
 * 讀取 AST 推導出的類型，若該類型包含複雜 inline 結構、`import(`、`typeof` 或是臨時的 Shape 類，
 * 則不予以採納（返回空字串），改由動態兜底推導。同時對基本類型進行 `widenTypeName` 寬化處理。
 * 
 * @param {any} type - ts-morph Type 物件。
 * @returns {string} 格式化後的乾淨型別描述字串，若不符採納標準則返回空字串。
 */
function getCleanTypeText(type: any): string {
  let text = type.getText();

  // 排除複雜的 inline object 或者是 import 等型別，或是包含臨時產生的 Shape
  const isComplexObject = /\{\s*[a-zA-Z_$][\w_$]*\s*:/.test(text) || text.includes(';');

  if (text.includes('import(') || isComplexObject || text.includes('typeof') || text.includes('=>') || text.includes('prototype') || text.includes('Shape')) {
    return '';
  }

  // 排除 some basic cases
  if (text === 'any' || text === 'null' || text === 'undefined' || text === 'unknown') {
    return '';
  }

  // 排除無效的陣列型別以防阻礙 TypeScript Array Type Evolution (型別演進)
  const cleanText = text.replace(/\s+/g, '');
  if (
    cleanText === 'undefined[]' || 
    cleanText === 'never[]' || 
    cleanText === 'null[]' ||
    cleanText === 'Array<undefined>' || 
    cleanText === 'Array<never>' || 
    cleanText === 'Array<null>'
  ) {
    return '';
  }

  return widenTypeName(text);
}

/**
 * 在專案原始碼中根據名稱查找特定的 Interface 聲明節點。
 * 
 * @description
 * 遍歷專案所有源檔案，搜尋具有相同名稱的介面宣告。
 * 
 * @param {Project} project - ts-morph Project 專案實例。
 * @param {string} name - 欲搜尋的 Interface 名稱。
 * @returns {any|undefined} 匹配到的 InterfaceDeclaration 節點，若無則返回 `undefined`。
 */
function findInterfaceInProject(project: Project, name: string): any {
  for (const sourceFile of project.getSourceFiles()) {
    const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
    const matched = interfaces.find(i => i.getName() === name);
    if (matched) return matched;
  }
  return undefined;
}

/**
 * 取得屬性宣告的型別定義字串。
 * 
 * @description
 * 優先讀取 TS 型別系統的型別文字（過濾 `import(` 複雜引用），
 * 若無或失敗，則改回退取得其 AST 型別節點的原始碼文字，兜底為 `'any'`。
 * 
 * @param {any} prop - ts-morph 屬性節點對象。
 * @returns {string} 該屬性的型別描述字串。
 */
function getPropertyTypeString(prop: any): string {
  const type = prop.getType();
  if (type) {
    const typeStr = type.getText();
    if (!typeStr.includes('import(')) {
      return typeStr;
    }
  }
  const typeNode = prop.getTypeNode();
  if (typeNode) {
    return typeNode.getText();
  }
  return 'any';
}

/**
 * 安全地為 Class 類別新增成員屬性宣告。
 * 
 * @description
 * 嘗試調用 `insertProperty` 將屬性插入 Class 起頭。
 * 若拋出異常（如無構造函數或語法衝突），則降級使用文本分析與插字方式，
 * 尋找建構子或第一個方法的位置，動態寫入類別成員屬性聲明，避免重構中斷。
 * 
 * @param {any} cls - ClassDeclaration 類別節點對象。
 * @param {string} propName - 欲新增的屬性欄位名稱。
 * @param {string} [typeStr='any'] - 該屬性的型別字串。
 * @returns {void} 本方法不回傳值。
 */
function safeAddProperty(cls: any, propName: string, typeStr: string = 'any') {
  try {
    cls.insertProperty(0, {
      name: propName,
      type: typeStr,
      hasQuestionToken: false
    });
  } catch (err: any) {
    try {
      const ctor = cls.getConstructors()[0];
      if (ctor) {
        cls.insertText(ctor.getStart(), `${propName}: ${typeStr};\n  `);
      } else {
        const firstMethod = cls.getMethods()[0];
        if (firstMethod) {
          cls.insertText(firstMethod.getStart(), `${propName}: ${typeStr};\n  `);
        } else {
          const classText = cls.getText();
          const braceIdx = classText.indexOf('{');
          if (braceIdx !== -1) {
            cls.insertText(cls.getStart() + braceIdx + 1, `\n  ${propName}: ${typeStr};`);
          }
        }
      }
    } catch (fallbackErr: any) {
      console.warn(`⚠ [SafeAddProperty] 降級寫入成員屬性 ${propName} 失敗: ${fallbackErr.message}`);
    }
  }
}

/**
 * 將一般 JavaScript 註解清理並轉換為 JSDoc 標準區塊。
 * 
 * @description
 * 移除 `//`, `/*` 或是 `/**` 的標示，統一格式化為不帶引號註解的多行文本。
 * 
 * @param {string} comment - 原始註解內容字串。
 * @returns {string} 清理後的註解文本內容。
 */
function cleanCommentToJSDoc(comment: string): string {
  if (comment.startsWith('/**')) {
    return comment.replace(/^\/\*\*+/, '').replace(/\*+\/$/, '').trim();
  }
  if (comment.startsWith('/*')) {
    return comment.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim();
  }
  return comment.split('\n').map(line => line.replace(/^\/\/+/, '').trim()).join('\n');
}

/**
 * 為指定函數的參數進行 TypeScript 型別標註（Annotation）。
 * 
 * @description
 * 1. 取得函數參數列表。
 * 2. 比對對應的 `d.ts` 宣告檔型別，若有高信賴型別，優先套用。
 * 3. 若無 `d.ts` 資訊，則查詢 `typeDB` 中該參數的側錄記錄。
 * 4. 當側錄呼叫次數大於信賴閾值時，調用 `resolveParameterType` 推導類型並標註。
 * 5. 若側錄次數不足，則標記為低信賴度 any (`/* @inferred-low-confidence *\/ any`)。
 * 
 * @param {any} fnNode - 函數宣告或方法節點。
 * @param {string} fnName - 函數識別名稱。
 * @param {string} relPath - 目前檔案的專案相對路徑。
 * @param {any} typeDB - 記憶體型別側錄資料庫。
 * @param {Record<string, string>} interfacesToDeclare - 用於收集待聲明 Interface 的暫存映射物件。
 * @param {any} config - 主設定檔配置物件。
 * @param {any} [dtsInterface] - 同名類別在 d.ts 中的介面定義節點。
 * @returns {void} 本方法不回傳值。
 */
function annotateFunction(
  fnNode: any,
  fnName: string,
  relPath: string,
  typeDB: any,
  interfacesToDeclare: Record<string, string>,
  config: any,
  dtsInterface?: any,
  typeChecker?: TypeChecker
) {
  if (!fnNode || typeof fnNode.getParameters !== 'function') {
    return;
  }
  const confidenceThreshold = config.confidenceThreshold || 5;
  const params = fnNode.getParameters();

  const shortFnName = fnName.includes('.') ? fnName.split('.').pop()! : fnName;
  let dtsMethodOrType: any = undefined;
  if (dtsInterface && shortFnName) {
    if (typeof dtsInterface.getMethodSignature === 'function') {
      dtsMethodOrType = dtsInterface.getMethodSignature(shortFnName);
    } else if (typeof dtsInterface.getMethod === 'function') {
      dtsMethodOrType = dtsInterface.getMethod(shortFnName);
    }

    if (!dtsMethodOrType) {
      const dtsProp = dtsInterface.getProperty(shortFnName);
      if (dtsProp) {
        const typeNode = dtsProp.getTypeNode();
        if (typeNode && (typeNode.getKind() === SyntaxKind.FunctionType || typeNode.getKind() === SyntaxKind.TypeLiteral)) {
          dtsMethodOrType = typeNode;
        }
      }
    }
  }

  params.forEach((param: any, paramIdx: number) => {
    const paramName = param.getName();

    let dtsParamTypeStr: string | undefined = undefined;
    if (dtsMethodOrType) {
      if (dtsMethodOrType.getKind() === SyntaxKind.MethodSignature || dtsMethodOrType.getKind() === SyntaxKind.FunctionType) {
        const dtsParams = dtsMethodOrType.getParameters();
        const dtsParam = dtsParams.find((p: any) => p.getName() === paramName) || dtsParams[paramIdx];
        if (dtsParam) {
          const typeNode = dtsParam.getTypeNode();
          if (typeNode) {
            dtsParamTypeStr = typeNode.getText();
          }
        }
      }
    }

    if (dtsParamTypeStr && dtsParamTypeStr !== 'any') {
      if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
        param.setType(dtsParamTypeStr);
      }
    } else {
      const trackerId = `${relPath}::${fnName}::param::${paramName}`;
      const record = typeDB[trackerId];

      if (record && record.callCount >= confidenceThreshold) {
        const sanitizedFnName = fnName.replace(/\./g, '');
        const baseName = `${sanitizedFnName.charAt(0).toUpperCase()}${sanitizedFnName.slice(1)}${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
        const typeStr = resolveParameterType(record, baseName, interfacesToDeclare, fnNode.getProject());

        if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
          param.setType(typeStr);
        }
      } else if (record && record.callCount > 0) {
        if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
          param.setType('/* @inferred-low-confidence */ any');
        }
      }
    }
  });

  let dtsReturnTypeStr: string | undefined = undefined;
  if (dtsMethodOrType) {
    if (dtsMethodOrType.getKind() === SyntaxKind.MethodSignature || dtsMethodOrType.getKind() === SyntaxKind.FunctionType) {
      const returnTypeNode = dtsMethodOrType.getReturnTypeNode();
      if (returnTypeNode) {
        dtsReturnTypeStr = returnTypeNode.getText();
      }
    }
  }

  if (dtsReturnTypeStr && dtsReturnTypeStr !== 'any' && dtsReturnTypeStr !== 'void') {
    if (typeof fnNode.setReturnType === 'function' && !fnNode.getReturnTypeNode()) {
      fnNode.setReturnType(dtsReturnTypeStr);
    }
  }
}

/**
 * 推導並設定函數或方法的回傳值型別。
 * 
 * @description
 * 1. 優先透過 ts-morph 靜態 AST 分析 Return 語句，推導並寬化回傳值。
 * 2. 若推導失敗或回傳 any/空，則查詢 `typeDB` 中的回傳側錄。
 * 3. 當側錄呼叫次數大於信賴閾值時，套用側錄到的回傳型別。
 * 
 * @param {any} fnNode - 函數或方法節點。
 * @param {string} fnName - 函數識別名稱。
 * @param {string} relPath - 目前檔案的相對路徑。
 * @param {any} typeDB - 記憶體型別側錄資料庫。
 * @param {Record<string, string>} interfacesToDeclare - 用於收集待聲明 Interface 的暫存映射物件。
 * @param {any} config - 主設定檔配置物件。
 * @returns {void} 本方法不回傳值。
 */
function resolveAndSetReturnType(
  fnNode: any,
  fnName: string,
  relPath: string,
  typeDB: any,
  interfacesToDeclare: Record<string, string>,
  config: any,
  typeChecker?: TypeChecker
) {
  if (!fnNode || typeof fnNode.setReturnType !== 'function' || typeof fnNode.getReturnType !== 'function' || fnNode.getReturnTypeNode()) {
    return;
  }

  // 1. 優先嘗試 AST 推導
  const returnType = fnNode.getReturnType();
  let returnTypeText = getCleanTypeText(returnType);

  // 如果型別被 Widen 為 '{}' 或為空，手動收集 ReturnStatement 表達式型別以防過度簡化
  if (returnTypeText === '{}' || returnTypeText === '') {
    const returnStatements = fnNode.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    if (returnStatements.length > 0) {
      const types = new Set<string>();
      returnStatements.forEach(ret => {
        const expr = ret.getExpression();
        if (expr) {
          const exprType = expr.getType();
          const exprTypeText = getCleanTypeText(exprType);
          if (exprTypeText) {
            types.add(exprTypeText);
          } else {
            const exprText = expr.getText().trim();
            if (exprText === '{}') {
              types.add('{}');
            }
          }
        }
      });
      if (types.size > 0) {
        returnTypeText = Array.from(types).join(' | ');
      }
    }
  }

  if (returnTypeText && returnTypeText !== 'any') {
    fnNode.setReturnType(returnTypeText);
    return;
  }

  // 2. 如果 AST 無法推導出有效型別，使用 typeDB 兜底
  const confidenceThreshold = config.confidenceThreshold || 5;
  const returnTrackerId = `${relPath}::${fnName}::return`;
  const returnRecord = typeDB[returnTrackerId];
  if (returnRecord && returnRecord.callCount >= confidenceThreshold) {
    const sanitizedFnName = fnName.replace(/\./g, '');
    const baseName = `${sanitizedFnName.charAt(0).toUpperCase()}${sanitizedFnName.slice(1)}Return`;
    const typeStr = resolveParameterType(returnRecord, baseName, interfacesToDeclare, fnNode.getProject());
    if (typeStr && typeStr !== 'any') {
      fnNode.setReturnType(typeStr);
    }
  }
}

/**
 * 將檔案中的 CommonJS 模組語法（require/exports）重構為標準 ESM 模組語法（import/export）。
 * 
 * @description
 * 1. 尋找全域 `require` 表達式並轉為靜態 `import` 聲明（支援解構與預設導入）。
 * 2. 轉換 `module.exports = ...` 為 `export default ...`。
 * 3. 轉換 `exports.foo = ...` 或 `module.exports.foo = ...` 為具名的 `export const foo = ...`。
 * 
 * @param {any} sourceFile - ts-morph SourceFile 原始碼檔案節點對象。
 * @returns {void} 本方法直接修改 AST 節點，無回傳值。
 */
function refactorCjsToEsm(sourceFile: SourceFile) {
  // Query all require CallExpressions
  const requireCalls = sourceFile.query('CallExpression[expression.name="require"]');

  for (const call of requireCalls) {
    const decl = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (!decl) continue;

    const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    if (!stmt || stmt.getParent().getKind() !== SyntaxKind.SourceFile) continue;

    if (call.getArguments().length === 1) {
      const moduleSpecifier = call.getArguments()[0].getText().replace(/['"]/g, '');
      const nameNode = decl.getNameNode();
      const isDestructured = nameNode.getKind() === SyntaxKind.ObjectBindingPattern;

      if (isDestructured) {
        const elements = nameNode.getElements().map((el: any) => el.getName());
        sourceFile.addImportDeclaration({
          namedImports: elements,
          moduleSpecifier: moduleSpecifier
        });
      } else {
        sourceFile.addImportDeclaration({
          defaultImport: decl.getName(),
          moduleSpecifier: moduleSpecifier
        });
      }
      stmt.remove();
    }
  }

  // Query all binary assignments (operator token '=')
  const binaryAssignments = sourceFile.query(`BinaryExpression[operatorToken.kind=${SyntaxKind.EqualsToken}]`);

  for (const binary of binaryAssignments) {
    const stmt = binary.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!stmt || stmt.getParent().getKind() !== SyntaxKind.SourceFile) continue;

    const left = binary.getLeft();
    const right = binary.getRight();
    const leftText = left.getText();

    if (leftText === 'module.exports') {
      sourceFile.addExportAssignment({
        isExportEquals: false,
        expression: right.getText()
      });
      stmt.remove();
    } else if (leftText.startsWith('module.exports.')) {
      const propName = leftText.replace('module.exports.', '');
      sourceFile.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{ name: propName, initializer: right.getText() }],
        isExported: true
      });
      stmt.remove();
    } else if (leftText.startsWith('exports.')) {
      const propName = leftText.replace('exports.', '');
      sourceFile.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{ name: propName, initializer: right.getText() }],
        isExported: true
      });
      stmt.remove();
    }
  }
}

/**
 * 執行單一 JavaScript 檔案至 TypeScript 檔案的 AST 重構核心管線。
 * 
 * @description
 * 1. 建立對應的 `.ts` 虛擬 AST 樹。
 * 2. 清理現有的參數型別與 Interface。
 * 3. 執行 `refactorCjsToEsm` 完成 CommonJS 到 ESM 的語法轉換。
 * 4. 針對一般函數、類別方法、建構子以及變數箭頭函數：
 *    a. 呼叫 `annotateFunction` 注入參數型別（合併 d.ts 與 typeDB 側錄）。
 *    b. 呼叫 `resolveAndSetReturnType` 推導並標註回傳值型別。
 * 5. 針對類別：
 *    a. 分析建構子與 this 賦值，自動提升並聲明類別屬性（Field Declarations），並保留原註解為 JSDoc。
 *    b. 補齊漏掉的 Class 屬性，防範 TS2339 未宣告屬性錯誤。
 * 6. 在檔案開頭/結尾寫入自動生成的所有 `*Shape` Interface 介面宣告。
 * 
 * @param {string} filePath - 待重構的實體 JavaScript 檔案路徑。
 * @param {any} typeDB - 側錄型別資料庫。
 * @param {any} config - 重構主配置參數物件。
 * @param {string} inDir - 輸入的源碼目錄。
 * @param {Project} project - ts-morph Project 專案實例。
 * @returns {string} 重構轉換後的完整 TypeScript 原始碼字串。
 */
export function processFileRefactoring(
  sourceFile: SourceFile,
  typeChecker: TypeChecker,
  typeDB: any,
  config: any,
  inDir: string,
  project: Project
): void {
  const relPath = path.relative(inDir, sourceFile.getFilePath()).replace(/\\/g, '/');

  sourceFile.getInterfaces().forEach(iface => iface.remove());

  sourceFile.getDescendantsOfKind(SyntaxKind.Parameter).forEach(param => {
    param.removeType();
  });

  refactorCjsToEsm(sourceFile);

  const interfacesToDeclare: Record<string, string> = {};

  const functions = sourceFile.query('FunctionDeclaration');
  for (const fn of functions) {
    const fnName = fn.getName() || 'anonymous';
    if (typeof fn.removeReturnType === 'function') fn.removeReturnType();
    annotateFunction(fn, fnName, relPath, typeDB, interfacesToDeclare, config, undefined, typeChecker);
  }

  const classes = sourceFile.query('ClassDeclaration');
  for (const cls of classes) {
    const className = cls.getName();
    const dtsInterface = className ? findInterfaceInProject(project, className) : undefined;
    const classMethods = new Set(cls.getMethods().map((m: any) => m.getName()));

    const properties = new Set<string>();
    const thisAssignments = cls.query(
      `BinaryExpression[operatorToken.kind=${SyntaxKind.EqualsToken}]:has(PropertyAccessExpression[expression.kind=${SyntaxKind.ThisKeyword}])`
    );
    for (const binaryExpr of thisAssignments) {
      const left = binaryExpr.getLeft();
      if (left.getKind() === SyntaxKind.PropertyAccessExpression && left.getExpression().getText() === 'this') {
        const name = left.getName();
        if (name !== 'constructor') {
          properties.add(name);
        }
      }
    }

    const ctor = cls.getConstructors()[0];
    if (ctor) {
      const ctorParams = ctor.getParameters().map((p: any) => p.getName());
      const localVars = new Set<string>();
      const ctorLocalDecls = ctor.query('VariableDeclaration');
      for (const decl of ctorLocalDecls) {
        localVars.add(decl.getName());
      }

      const propertiesToMigrate: { propName: string; rightText: string; commentText: string }[] = [];
      const collectedPropNames = new Set<string>();

      const ctorAssignments = ctor.query(
        `BinaryExpression[operatorToken.kind=${SyntaxKind.EqualsToken}]:has(PropertyAccessExpression[expression.kind=${SyntaxKind.ThisKeyword}])`
      );
      for (const binary of ctorAssignments) {
        const stmt = binary.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
        if (!stmt || stmt.getParent() !== ctor.getBody()) continue;

        const left = binary.getLeft();
        const right = binary.getRight();
        const propName = left.getName();
        const rightText = right.getText();

        if (classMethods.has(propName)) continue;
        if (collectedPropNames.has(propName)) continue;
        if (rightText.includes('this.')) continue;

        let isSafe = true;
        for (const param of ctorParams) {
          const regex = new RegExp(`\\b${param}\\b`);
          if (regex.test(rightText)) {
            isSafe = false;
            break;
          }
        }
        if (isSafe) {
          for (const localVar of localVars) {
            const regex = new RegExp(`\\b${localVar}\\b`);
            if (regex.test(rightText)) {
              isSafe = false;
              break;
            }
          }
        }

        if (isSafe && propName !== 'constructor') {
          const leadingCommentRanges = stmt.getLeadingCommentRanges();
          let commentText = '';
          if (leadingCommentRanges && leadingCommentRanges.length > 0) {
            commentText = leadingCommentRanges.map((r: any) => r.getText()).join('\n');
          }

          collectedPropNames.add(propName);
          propertiesToMigrate.push({
            propName,
            rightText,
            commentText
          });
        }
      }

      const propertiesStructures = propertiesToMigrate.map(item => {
        let propType: string | undefined = undefined;
        if (dtsInterface) {
          const dtsProp = dtsInterface.getProperty(item.propName);
          if (dtsProp) {
            propType = getPropertyTypeString(dtsProp);
          }
        }

        const struct: any = {
          name: item.propName,
          initializer: item.rightText,
          type: propType,
          hasQuestionToken: false
        };
        if (item.commentText) {
          struct.docs = [cleanCommentToJSDoc(item.commentText)];
        }
        return struct;
      });

      if (propertiesStructures.length > 0) {
        cls.insertProperties(0, propertiesStructures);
      }

      propertiesToMigrate.forEach(item => {
        properties.delete(item.propName);
      });

      const migratedPropsSet = new Set(propertiesToMigrate.map(x => x.propName));
      const currentStatements = ctor.getStatements();
      for (let i = currentStatements.length - 1; i >= 0; i--) {
        const stmt = currentStatements[i] as any;
        if (stmt.getKind() === SyntaxKind.ExpressionStatement) {
          const expr = stmt.getExpression();
          if (expr.getKind() === SyntaxKind.BinaryExpression) {
            const left = expr.getLeft();
            if (left.getKind() === SyntaxKind.PropertyAccessExpression && expr.getOperatorToken().getText() === '=') {
              const propAccess = left;
              if (propAccess.getExpression().getText() === 'this') {
                const propName = propAccess.getName();
                if (migratedPropsSet.has(propName)) {
                  stmt.remove();
                }
              }
            }
          }
        }
      }
    }

    const existingProps = new Set(cls.getProperties().map(p => p.getName()));

    properties.forEach(prop => {
      if (!existingProps.has(prop) && !classMethods.has(prop)) {
        let propType = 'any';
        if (dtsInterface) {
          const dtsProp = dtsInterface.getProperty(prop);
          if (dtsProp) {
            propType = getPropertyTypeString(dtsProp);
          }
        }
        safeAddProperty(cls, prop, propType);
      }
    });

    cls.getMethods().forEach(method => {
      const fnName = method.getName();
      if (typeof method.removeReturnType === 'function') method.removeReturnType();
      annotateFunction(method, `${cls.getName()}.${fnName}`, relPath, typeDB, interfacesToDeclare, config, dtsInterface, typeChecker);
    });

    cls.getConstructors().forEach(ctor => {
      annotateFunction(ctor, `${cls.getName()}.constructor`, relPath, typeDB, interfacesToDeclare, config, dtsInterface, typeChecker);
    });

    if (dtsInterface) {
      cls.getProperties().forEach(prop => {
        const propName = prop.getName();
        const dtsProp = dtsInterface.getProperty(propName);
        if (dtsProp) {
          const dtsTypeStr = getPropertyTypeString(dtsProp);
          const currentType = prop.getTypeNode()?.getText() || '';
          if (!currentType || currentType === 'any' || currentType.includes('any')) {
            prop.setType(dtsTypeStr);
          }
        }
      });
    }

    cls.getMethods().forEach(method => {
      const decls = query(method, 'VariableDeclaration');
      for (const decl of decls) {
        if (decl.getKind() === SyntaxKind.VariableDeclaration && !decl.getTypeNode()) {
          const init = decl.getInitializer();
          if (init) {
            const type = init.getType();
            const typeText = getCleanTypeText(type);
            if (typeText) {
              decl.setType(typeText);
            }
          }
        }
      }
    });

    const thisCalls = query(
      cls,
      `CallExpression:has(PropertyAccessExpression[expression.kind=${SyntaxKind.ThisKeyword}])`
    );
    for (const call of thisCalls) {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr;
        const methodName = propAccess.getName();
        const targetMethod = cls.getMethod(methodName);
        if (targetMethod) {
          const args = call.getArguments();
          const params = targetMethod.getParameters();
          args.forEach((arg: any, idx: number) => {
            const param = params[idx];
            if (param && !param.getTypeNode()) {
              const argType = arg.getType();
              const argTypeText = getCleanTypeText(argType);
              if (argTypeText) {
                param.setType(argTypeText);
              }
            }
          });
        }
      }
    }

    cls.getMethods().forEach(method => {
      const fnName = method.getName();
      resolveAndSetReturnType(method, `${cls.getName()}.${fnName}`, relPath, typeDB, interfacesToDeclare, config, typeChecker);
    });
  }

  const fnVarDecls = query(
    sourceFile,
    'VariableDeclaration:has(ArrowFunction, FunctionExpression)'
  );
  for (const decl of fnVarDecls) {
    if (decl.getKind() === SyntaxKind.VariableDeclaration) {
      const init = decl.getInitializer();
      if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
        const fnName = decl.getName();
        annotateFunction(init, fnName, relPath, typeDB, interfacesToDeclare, config, undefined, typeChecker);
        resolveAndSetReturnType(init, fnName, relPath, typeDB, interfacesToDeclare, config, typeChecker);
      }
    }
  }

  const functionDecls = query(sourceFile, 'FunctionDeclaration');
  for (const fn of functionDecls) {
    const fnName = fn.getName() || 'anonymous';
    resolveAndSetReturnType(fn, fnName, relPath, typeDB, interfacesToDeclare, config, typeChecker);
  }

  const interfaceDeclarations = Object.values(interfacesToDeclare).join('\n\n');
  if (interfaceDeclarations) {
    const imports = sourceFile.getImportDeclarations();
    if (imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      sourceFile.insertText(lastImport.getEnd(), '\n\n' + interfaceDeclarations + '\n');
    } else {
      sourceFile.insertText(0, interfaceDeclarations + '\n\n');
    }
  }
}
