/**
 * @file type-utils.ts
 * @description
 * 型別推導工具函式群。
 *
 * 包含以下功能：
 * - 物件 Shape 合併與寬化（mergeObjectShapesArray、widenTypeName）
 * - TypeScript Interface 程式碼生成（shapeToInterfaceBody、formatInterfaceKey）
 * - 專案內 Interface 搜尋（findMatchingInterface、findInterfaceInProject）
 * - 型別字串解析與清理（unwrapImportType、getCleanTypeText、resolveParameterType）
 * - Class 屬性型別查詢（getPropertyTypeString、safeAddProperty）
 * - 注解清理（cleanCommentToJSDoc）
 */

import * as path from 'path';
import { Project, SyntaxKind } from 'ts-morph';
import { mergeSingleVal } from '../type-merger';

// ── mergeObjectShapesArray ───────────────────────────────────────────────────

/**
 * 合併多個物件字面量 Shape，計算出合併後的寬化單一 Shape。
 *
 * 遍歷所有 Shape，將相同的欄位名歸納，並透過 `mergeSingleVal` 對型別進行寬化。
 * 若某欄位在部分 Shape 中缺失，自動標記為含有 `undefined` 的可選屬性。
 *
 * @param shapes - 包含多個物件結構（Shape）的陣列
 * @returns 合併寬化後的單一 Shape 物件結構
 */
export function mergeObjectShapesArray(shapes: any[]): any {
  if (shapes.length === 0) return {};
  if (shapes.length === 1) return shapes[0];

  const combined: any = {};

  // 收集所有 Shape 中出現的欄位名（排除內部標記 __nullable）
  const allKeys = new Set<string>();
  shapes.forEach(s => {
    Object.keys(s).filter(k => k !== '__nullable').forEach(k => allKeys.add(k));
  });

  for (const key of allKeys) {
    let existCount = 0;
    const valTypes: any[] = [];

    // 統計每個 Shape 中該欄位的出現次數與型別
    shapes.forEach(s => {
      if (s[key] !== undefined) {
        existCount++;
        valTypes.push(s[key]);
      }
    });

    // 將所有觀察到的型別 reduce 合併為單一寬化型別
    let mergedVal = 'any';
    if (valTypes.length > 0) {
      mergedVal = valTypes.reduce((acc, curr) => mergeSingleVal(acc, curr));
    }

    // 若欄位不在所有 Shape 中出現，補充 undefined 使其成為可選屬性
    if (existCount < shapes.length) {
      mergedVal = mergeSingleVal(mergedVal, 'undefined');
    }

    combined[key] = mergedVal;
  }

  // 傳遞 nullable 標記
  if (shapes.some(s => s.__nullable)) {
    combined.__nullable = true;
  }

  return combined;
}

// ── formatInterfaceKey ───────────────────────────────────────────────────────

/**
 * 格式化介面或物件字面量的 Key 名稱。
 *
 * 若 Key 包含特殊字元或不符合變數命名規範，使用 JSON.stringify 進行引號包裹。
 *
 * @param key - 原始 Key 欄位名稱
 * @returns 格式化後的 Key 字串
 */
export function formatInterfaceKey(key: string): string {
  // 符合 JavaScript 合法識別子規則時直接回傳，否則加引號
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
    return key;
  }
  return JSON.stringify(key);
}

// ── shapeToInterfaceBody ─────────────────────────────────────────────────────

/**
 * 將物件字面量 Shape 遞迴轉換為 TypeScript Interface 的主體程式碼字串。
 *
 * 遍歷 Shape 物件，逐個屬性寫為 `key: type;`。
 * 若屬性為嵌套物件，遞迴處理。
 * 若屬性包含 `undefined`，設為可選屬性 `key?: type;`。
 * 末尾統一追加 `[key: string]: any;` 索引簽名以提升型別相容性。
 *
 * @param shape - 包含欄位型別映射的 Shape 結構
 * @param depth - 目前嵌套遞迴的深度（用於縮排），預設為 1
 * @returns Interface 內部成員定義的程式碼字串
 */
export function shapeToInterfaceBody(shape: any, depth = 1): string {
  const indent = '  '.repeat(depth);
  let body = '';

  for (const [key, typeVal] of Object.entries(shape)) {
    if (key === '__nullable') continue;

    let isOptional = false;
    let finalType = 'any';

    if (typeof typeVal === 'object') {
      // 嵌套物件：遞迴產生子 body
      const subBody = shapeToInterfaceBody(typeVal, depth + 1);
      finalType = `{\n${subBody}${'  '.repeat(depth)}}`;
      if ((typeVal as any).__nullable) {
        finalType += ' | null';
      }
    } else {
      let typeStr = typeVal as string;
      const parts = typeStr.split(' | ');
      // 含 undefined → 可選屬性，從 union 中移除 undefined
      if (parts.includes('undefined')) {
        isOptional = true;
        typeStr = parts.filter(p => p !== 'undefined').join(' | ') || 'any';
      }
      finalType = typeStr;
    }

    const formattedKey = formatInterfaceKey(key);
    body += `${indent}${formattedKey}${isOptional ? '?' : ''}: ${finalType};\n`;
  }

  // 加入索引簽名，讓 Shape Interface 對動態屬性存取保持相容
  body += `${indent}[key: string]: any;\n`;
  return body;
}

// ── findMatchingInterface ────────────────────────────────────────────────────

/**
 * 在專案中尋找與當前 Shape 結構特徵相符的既有 Interface 名稱。
 *
 * 避免生成重複的 `*Shape` 介面。遍歷專案所有介面定義，
 * 比對其屬性鍵名是否能 100% 覆蓋當前 Shape 的鍵名（至少 2 個欄位符合）。
 *
 * @param project - ts-morph Project 專案實例
 * @param shape   - 欲進行比對的 Shape 結構
 * @returns 匹配到的 Interface 名稱，若無則回傳 `null`
 */
export function findMatchingInterface(project: Project, shape: any): string | null {
  const shapeKeys = Object.keys(shape).filter(k => k !== '__nullable');
  if (shapeKeys.length === 0) return null;

  for (const sourceFile of project.getSourceFiles()) {
    const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
    for (const iface of interfaces) {
      const ifaceName = iface.getName();
      // 跳過自動生成的 *Shape 介面，避免循環比對
      if (ifaceName.endsWith('Shape')) continue;

      const ifaceProps = iface.getProperties();
      const ifacePropNames = new Set(ifaceProps.map(p => p.getName()));

      // 計算 Shape key 與介面屬性的交集數量
      let matchCount = 0;
      for (const key of shapeKeys) {
        if (ifacePropNames.has(key)) {
          matchCount++;
        }
      }

      // 所有 key 都匹配且至少 2 個才算找到
      if (matchCount === shapeKeys.length && shapeKeys.length >= 2) {
        return ifaceName;
      }
    }
  }
  return null;
}

// ── widenTypeName ────────────────────────────────────────────────────────────

/**
 * 將特定字面量型別寬化為對應的 TypeScript 基礎型別。
 *
 * 規則：
 * - `'true'` / `'false'` → `'boolean'`
 * - 數值字串 → `'number'`
 * - 各式引號包裹的字串 → `'string'`
 * - 支援聯集型別（` | `）的分割遞迴寬化
 *
 * @param t - 原始的字面量型別字串（如 `"abc"`、`42` 等）
 * @returns 寬化後的基礎型別字串（如 `string`、`number` 等）
 */
export function widenTypeName(t: string): string {
  // 處理 union 型別：各部分分別寬化，再去重合併
  if (t.includes(' | ')) {
    const parts = t.split(' | ').map(p => widenTypeName(p));
    return Array.from(new Set(parts)).join(' | ');
  }
  const clean = t.trim();
  if (clean === 'true' || clean === 'false') {
    return 'boolean';
  }
  if (!clean) return t;
  // 純數值字串 → number
  if (!isNaN(Number(clean))) {
    return 'number';
  }
  // 各種引號包裹的字串字面量 → string
  if ((clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'")) ||
    (clean.startsWith("`") && clean.endsWith("`"))) {
    return 'string';
  }
  return t;
}

// ── resolveParameterType ─────────────────────────────────────────────────────

/**
 * 依據側錄記錄與現有 d.ts 規則，解析並推導最合適的參數型別字串。
 *
 * 處理流程：
 * 1. 提取 basicTypes 與 objectShapes
 * 2. 對基礎型別執行 `widenTypeName` 寬化
 * 3. 對物件 Shape 呼叫 `findMatchingInterface` 尋找既有介面；若無則自動生成新 `*Shape`
 * 4. 處理可為 null 或 undefined 的聯集型別，並過濾 `[object Object]`
 *
 * @param record             - 從 typeDB 取得的單一參數側錄記錄點
 * @param baseName           - 用於自動生成 Interface 名稱的前綴底標
 * @param interfacesToDeclare - 用於收集待寫入 Interface 的暫存映射物件
 * @param project            - ts-morph Project 專案實例（可選）
 * @returns 推導出的 TypeScript 參數型別定義字串
 */
export function resolveParameterType(
  record: any,
  baseName: string,
  interfacesToDeclare: Record<string, string>,
  project?: Project
): string {
  const observedTypes = record.observedTypes || [];

  // 分離基礎型別與物件 Shape 型別
  const basicTypes: string[] = [];
  const objectShapes: any[] = [];

  for (const t of observedTypes) {
    if (typeof t === 'string') {
      // 過濾掉 [object Object]（JSON 序列化失敗的物件）
      if (t !== '[object Object]') {
        basicTypes.push(t);
      }
    } else if (typeof t === 'object' && t !== null) {
      objectShapes.push(t);
    }
  }

  const resultTypes: string[] = [];

  // ── 處理基礎型別 ──────────────────────────────────────────────────────────
  if (basicTypes.length > 0) {
    const widenedTypes = basicTypes.map(t => widenTypeName(t));
    const uniqueWidened = Array.from(new Set(widenedTypes)).filter(
      t => t && t !== 'undefined' && t !== 'null'
    );
    resultTypes.push(...uniqueWidened);
  }

  // ── 處理物件 Shape ────────────────────────────────────────────────────────
  if (objectShapes.length > 0) {
    const mergedShape = mergeObjectShapesArray(objectShapes);

    // 嘗試從專案現有介面中找到結構匹配的命名介面
    let ifaceName: string | null = null;
    if (project) {
      ifaceName = findMatchingInterface(project, mergedShape);
    }

    if (ifaceName) {
      // 復用既有介面
      resultTypes.push(ifaceName);
    } else {
      // 沒有現成介面：自動生成並暫存 *Shape 介面定義
      const shapeName = `${baseName}Shape`;
      if (!interfacesToDeclare[shapeName]) {
        const body = shapeToInterfaceBody(mergedShape);
        interfacesToDeclare[shapeName] = `interface ${shapeName} {\n${body}}`;
      }
      resultTypes.push(shapeName);
    }

    // 若有 nullable 標記，補充 null
    if (objectShapes.some(s => s.__nullable)) {
      resultTypes.push('null');
    }
  }

  // ── 處理 null / undefined ─────────────────────────────────────────────────
  if (record.observedNull) resultTypes.push('null');
  if (record.observedUndefined) resultTypes.push('undefined');

  if (resultTypes.length === 0) return 'any';

  return Array.from(new Set(resultTypes)).join(' | ');
}

// ── unwrapImportType ─────────────────────────────────────────────────────────

/**
 * 將 TypeScript 編譯器推導的 `import("...").SomeType` 複雜引用，
 * 解開並還原為乾淨的具名型別字串（如 `Tune`、`Tune[]`）。
 *
 * 處理流程：
 * 1. 偵測是否為陣列型別（`[]` 或 `Array<...>`）
 * 2. 使用正則提取 import 路徑與型別名稱
 * 3. 若型別名稱為 `default`，追蹤目標檔案的預設匯出並取得實際名稱
 *
 * @param text    - 含有 import(...) 的型別字串
 * @param project - ts-morph Project 專案實例（用於追蹤檔案）
 * @returns 還原後的乾淨型別名稱字串
 */
export function unwrapImportType(text: string, project: Project): string {
  let isArray = false;
  let cleanText = text.trim();

  // 偵測並剝離陣列標記
  if (cleanText.endsWith('[]')) {
    isArray = true;
    cleanText = cleanText.slice(0, -2);
  } else if (cleanText.startsWith('Array<') && cleanText.endsWith('>')) {
    isArray = true;
    cleanText = cleanText.slice(6, -1);
  }

  // 提取 import(...).TypeName 格式
  const match = cleanText.match(/import\((['"])(.*?)\1\)\.(default|[a-zA-Z0-9_$]+)/);
  if (!match) return text;

  const importPath = match[2];
  const typeName = match[3];
  let resolvedName = typeName;

  if (typeName === 'default') {
    resolvedName = 'any';
    try {
      // 透過多種副檔名嘗試找到目標檔案
      let targetFile = project.getSourceFile(importPath);
      if (!targetFile) {
        for (const ext of ['.ts', '.tsx', '.d.ts', '.js', '.jsx']) {
          targetFile = project.getSourceFile(importPath + ext);
          if (targetFile) break;
        }
      }

      if (targetFile) {
        // 嘗試從預設匯出的 Symbol 取名稱
        const defSymbol = targetFile.getDefaultExportSymbol();
        if (defSymbol) {
          const decls = defSymbol.getDeclarations();
          if (decls.length > 0) {
            const firstDecl = decls[0] as any;
            const name = firstDecl.getName ? firstDecl.getName() : null;
            if (name) resolvedName = name;
          }
        }
        // 備援：直接掃描函數與類別的預設匯出
        if (resolvedName === 'any') {
          const fn = targetFile.getFunctions().find(f => f.isDefaultExport());
          if (fn && fn.getName()) resolvedName = fn.getName()!;
          const cls = targetFile.getClasses().find(c => c.isDefaultExport());
          if (cls && cls.getName()) resolvedName = cls.getName()!;
        }
      }
    } catch (e) { }

    // 最後兜底：根據檔名推導 PascalCase 類別名
    if (resolvedName === 'any') {
      const base = path.basename(importPath, path.extname(importPath));
      if (base === 'abc_tune') resolvedName = 'Tune';
      else {
        resolvedName = base
          .split(/[-_]/)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
      }
    }
  }

  return isArray ? `${resolvedName}[]` : resolvedName;
}

// ── getCleanTypeText ─────────────────────────────────────────────────────────

/**
 * 從 ts-morph 型別物件中取得乾淨、可直接用於標注的型別字串。
 *
 * 過濾規則：
 * - 含 `import(...)` 的複雜引用 → 呼叫 `unwrapImportType` 解包
 * - inline object 字面量或含 `;` 的複雜型別 → 回傳空字串
 * - `any`、`null`、`undefined`、`unknown` → 回傳空字串（讓 TypeChecker 自行推導）
 * - 空陣列初始化產生的 `never[]`、`undefined[]`、`null[]` → 回傳空字串
 * - 其餘有效型別 → 經 `widenTypeName` 寬化後回傳
 *
 * @param type    - ts-morph Type 物件
 * @param project - ts-morph Project 實例（用於 unwrapImportType）
 * @returns 乾淨的型別字串，或空字串（表示不應標注）
 */
export function getCleanTypeText(type: any, project?: Project): string {
  let text = type.getText();

  // 解包 import(...) 複雜型別引用
  if (text.includes('import(') && project) {
    text = unwrapImportType(text, project);
  }

  // 排除複雜 inline object 或含 import 的型別，以及含 Shape 名稱的暫存型別
  const isComplexObject = /\{\s*[a-zA-Z_$][\w_$]*\s*:/.test(text) || text.includes(';');
  if (
    text.includes('import(') ||
    isComplexObject ||
    text.includes('typeof') ||
    text.includes('=>') ||
    text.includes('prototype') ||
    text.includes('Shape')
  ) {
    return '';
  }

  // 排除無意義的弱型別
  if (text === 'any' || text === 'null' || text === 'undefined' || text === 'unknown') {
    return '';
  }

  // 排除無效陣列型別，防止阻礙 TypeScript Array Type Evolution（型別演進）
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

// ── findInterfaceInProject ───────────────────────────────────────────────────

/**
 * 在專案原始碼中根據名稱查找特定的 Interface 聲明節點。
 *
 * 遍歷專案所有源檔案，搜尋具有相同名稱的介面宣告。
 *
 * @param project - ts-morph Project 專案實例
 * @param name    - 欲搜尋的 Interface 名稱
 * @returns 匹配到的 InterfaceDeclaration 節點，若無則回傳 `undefined`
 */
export function findInterfaceInProject(project: Project, name: string): any {
  for (const sourceFile of project.getSourceFiles()) {
    const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration);
    const matched = interfaces.find(i => i.getName() === name);
    if (matched) return matched;
  }
  return undefined;
}

// ── getPropertyTypeString ────────────────────────────────────────────────────

/**
 * 取得屬性宣告的型別定義字串。
 *
 * 優先讀取 TS 型別系統的型別文字（過濾 `import(` 複雜引用），
 * 若無或失敗，回退取得 AST 型別節點的原始碼文字，兜底為 `'any'`。
 *
 * @param prop - ts-morph 屬性節點物件
 * @returns 該屬性的型別描述字串
 */
export function getPropertyTypeString(prop: any): string {
  const type = prop.getType();
  if (type) {
    const typeStr = type.getText();
    // 排除含有跨模組 import 路徑的複雜型別
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

// ── safeAddProperty ──────────────────────────────────────────────────────────

/**
 * 安全地為 Class 類別新增成員屬性宣告。
 *
 * 優先使用 `insertProperty` API 在類別開頭插入。
 * 若拋出異常（如無建構子或語法衝突），降級為文本搜尋方式：
 * 尋找建構子或第一個方法的位置，動態寫入屬性宣告，避免重構中斷。
 *
 * @param cls      - ClassDeclaration 類別節點物件
 * @param propName - 欲新增的屬性欄位名稱
 * @param typeStr  - 該屬性的型別字串，預設為 `'any'`
 */
export function safeAddProperty(cls: any, propName: string, typeStr: string = 'any') {
  try {
    cls.insertProperty(0, {
      name: propName,
      type: typeStr,
      hasQuestionToken: false
    });
  } catch (err: any) {
    try {
      // 降級策略 1：插入在建構子前
      const ctor = cls.getConstructors()[0];
      if (ctor) {
        cls.insertText(ctor.getStart(), `${propName}: ${typeStr};\n  `);
      } else {
        // 降級策略 2：插入在第一個方法前
        const firstMethod = cls.getMethods()[0];
        if (firstMethod) {
          cls.insertText(firstMethod.getStart(), `${propName}: ${typeStr};\n  `);
        } else {
          // 降級策略 3：找開括號後插入
          const classText = cls.getText();
          const braceIdx = classText.indexOf('{');
          if (braceIdx !== -1) {
            cls.insertText(cls.getStart() + braceIdx + 1, `\n  ${propName}: ${typeStr};`);
          }
        }
      }
    } catch (fallbackErr: any) {
      console.warn(`⚠ [safeAddProperty] 降級寫入成員屬性 ${propName} 失敗: ${fallbackErr.message}`);
    }
  }
}

// ── cleanCommentToJSDoc ──────────────────────────────────────────────────────

/**
 * 將一般 JavaScript 註解清理並轉換為 JSDoc 標準區塊內文。
 *
 * 支援三種格式：
 * - 單行 `//`
 * - 區塊 `/* * /`
 * - JSDoc `/** * /`
 * 統一清除各格式的開頭標記與結尾標記，回傳純文字內容。
 *
 * @param comment - 原始註解內容字串
 * @returns 清理後的純文字注解內容
 */
export function cleanCommentToJSDoc(comment: string): string {
  if (comment.startsWith('/**')) {
    return comment.replace(/^\/\*\*+/, '').replace(/\*+\/$/, '').trim();
  }
  if (comment.startsWith('/*')) {
    return comment.replace(/^\/\*+/, '').replace(/\*+\/$/, '').trim();
  }
  // 單行注解：每行去掉開頭的 //
  return comment.split('\n').map(line => line.replace(/^\/\/+/, '').trim()).join('\n');
}
