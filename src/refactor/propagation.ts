/**
 * @file propagation.ts
 * @description
 * 全域型別傳播模組。
 *
 * 包含以下功能：
 * - `runGlobalReversePropagation`：反向傳播（Reverse Propagation）
 *   遍歷所有呼叫站（Call Sites），將引數型別反向注入被呼叫函數的參數
 * - `runGlobalForwardPropagation`：正向傳播（Forward Propagation）
 *   遍歷所有局部變數宣告，從 Initializer 推導型別並標注
 * - `runGlobalReturnTypePropagation`：回傳型別傳播（Return Type Propagation）
 *   對所有函數與方法推導並注入回傳值型別
 * - `writeInterfaceDeclarations`：將收集到的 Shape Interface 寫入 SourceFile
 *
 * 內部輔助函式（非 export）：
 * - `getAliasedSymbol`：遞迴解開 Symbol 別名
 * - `resolveImportTarget`：靜態追蹤 Import 目標宣告
 * - `resolvePropertyAccessCallee`：解析屬性方法呼叫（如 `obj.method()`）的目標
 * - `resolveCalleeDeclaration`：整合 TypeChecker 與靜態分析的呼叫解析
 */

import * as path from 'path';
import { Project, SyntaxKind, SourceFile, TypeChecker } from 'ts-morph';
import { getCleanTypeText, resolveParameterType } from './type-utils';
import { resolveAndSetReturnType } from './annotate';

// ── getAliasedSymbol ─────────────────────────────────────────────────────────

/**
 * 遞迴解開 Symbol 別名，獲取實際指向的原始終端 Symbol。
 *
 * 用於解決 re-export、`export { X as Y }` 等別名情境，
 * 確保型別解析能追蹤到真正的宣告。
 *
 * @param symbol      - 起始 Symbol 物件
 * @param typeChecker - TypeChecker 實例
 * @returns 最終指向的非別名 Symbol
 */
function getAliasedSymbol(symbol: any, typeChecker: TypeChecker): any {
  let current = symbol;
  while (current && current.isAlias()) {
    try {
      const aliased = typeChecker.getAliasedSymbol(current);
      if (aliased && aliased !== current) {
        current = aliased;
      } else {
        break; // 找到最終 Symbol 或無法繼續解開
      }
    } catch (e) {
      break;
    }
  }
  return current;
}

// ── resolveImportTarget ──────────────────────────────────────────────────────

/**
 * 靜態解析 Import 宣告，找到指定名稱對應的函數 / 類別 / 變數宣告節點。
 *
 * 支援 default import 與 named import 兩種形式，
 * 並嘗試多種副檔名（`.ts`, `.tsx`, `.d.ts` 等）定位目標檔案。
 *
 * @param sourceFile - 起始原始碼檔案（用於取得 import 宣告列表）
 * @param name       - 欲解析的識別子名稱（如 `MidiSequencer`）
 * @param project    - ts-morph Project 實例
 * @returns 對應的宣告節點，若找不到回傳 `null`
 */
function resolveImportTarget(sourceFile: SourceFile, name: string, project: Project): any {
  const imports = sourceFile.getImportDeclarations();

  for (const imp of imports) {
    const defaultImp = imp.getDefaultImport();
    const namedImps = imp.getNamedImports();

    let isMatch = false;
    let isDefault = false;

    // 檢查 default import 或 named import 是否符合目標名稱
    if (defaultImp && defaultImp.getText() === name) {
      isMatch = true;
      isDefault = true;
    } else {
      for (const named of namedImps) {
        if (named.getName() === name) {
          isMatch = true;
          break;
        }
      }
    }

    if (isMatch) {
      const specifier = imp.getModuleSpecifierValue();
      const dir = path.dirname(sourceFile.getFilePath());
      let targetPath = path.resolve(dir, specifier);

      // 嘗試各種副檔名找到目標檔案
      let targetFile = project.getSourceFile(targetPath);
      if (!targetFile) {
        for (const ext of ['.ts', '.tsx', '.d.ts', '/index.ts', '/index.tsx', '.js', '.jsx']) {
          const p = targetPath + ext;
          targetFile = project.getSourceFile(p);
          if (targetFile) break;
        }
      }

      if (!targetFile) continue;

      if (isDefault) {
        // default import：找預設匯出
        const defSymbol = targetFile.getDefaultExportSymbol();
        if (defSymbol) {
          const decls = defSymbol.getDeclarations();
          if (decls.length > 0) return decls[0];
        }
        const fn = targetFile.getFunctions().find(f => f.isDefaultExport());
        if (fn) return fn;
        const cls = targetFile.getClasses().find(c => c.isDefaultExport());
        if (cls) return cls;
      } else {
        // named import：找具名匯出的函數 / 類別 / 變數
        const fn = targetFile.getFunctions().find(f => f.getName() === name && f.isExported());
        if (fn) return fn;
        const cls = targetFile.getClasses().find(c => c.getName() === name && c.isExported());
        if (cls) return cls;
        const varDecl = targetFile.getVariableDeclaration(name);
        if (varDecl && varDecl.isExported()) return varDecl;
      }
    }
  }
  return null;
}

// ── resolvePropertyAccessCallee ──────────────────────────────────────────────

/**
 * 靜態與動態解析屬性方法呼叫（如 `sequencer.sequence()`）的目標方法宣告。
 *
 * 解析策略（依優先順序）：
 * 1. 使用 TypeChecker 從物件型別的 Symbol 找到對應的 Class 方法
 * 2. 靜態向上追蹤變數，找到 `new ClassName()` 的初始化，定位類別中的方法
 *
 * @param propAccess - PropertyAccessExpression 節點（如 `sequencer.sequence`）
 * @param project    - ts-morph Project 實例
 * @returns 目標方法的宣告節點，若找不到回傳 `null`
 */
function resolvePropertyAccessCallee(propAccess: any, project: Project): any {
  const propName = propAccess.getName();
  const obj = propAccess.getExpression();

  // 1. 嘗試使用 TypeChecker 直接從物件型別查找方法
  const objType = obj.getType();
  if (objType && !objType.isAny() && !objType.isUnknown()) {
    const symbol = objType.getSymbol() || objType.getAliasSymbol();
    if (symbol) {
      const decls = symbol.getDeclarations();
      for (const decl of decls) {
        if (decl.getKind() === SyntaxKind.ClassDeclaration) {
          const method = (decl as any).getMethod(propName);
          if (method) return method;
        }
      }
    }
  }

  // 2. 靜態分析：向上尋找變數的 new 來源
  if (obj.getKind() === SyntaxKind.Identifier) {
    const objName = obj.getText();
    const sourceFile = propAccess.getSourceFile();

    // 逐層向上搜尋所在區塊的變數宣告
    let current: any = obj;
    let foundVar: any = null;
    while (current) {
      const block = current.getFirstAncestorByKind(SyntaxKind.Block) || sourceFile;
      const varDecls = block.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      foundVar = varDecls.find((v: any) => v.getName() === objName);
      if (foundVar) break;
      current = block.getParent();
    }

    if (foundVar) {
      const init = foundVar.getInitializer();
      if (init && init.getKind() === SyntaxKind.NewExpression) {
        const className = init.getExpression().getText();
        // 先在當前檔案找，再跨檔案追蹤 import
        let targetClass = sourceFile.getClass(className);
        if (!targetClass) {
          targetClass = resolveImportTarget(sourceFile, className, project);
        }
        if (targetClass && targetClass.getKind() === SyntaxKind.ClassDeclaration) {
          const method = targetClass.getMethod(propName);
          if (method) return method;
        }
      }
    }
  }

  return null;
}

// ── resolveCalleeDeclaration ─────────────────────────────────────────────────

/**
 * 整合 TypeChecker 與靜態分析，解析 CallExpression 的被呼叫者宣告節點。
 *
 * 解析策略（依優先順序）：
 * 1. TypeChecker：取 Symbol 再遞迴解開別名
 * 2. 靜態 PropertyAccessExpression 解析（如 `obj.method()`）
 * 3. 靜態 Import 追蹤（如 `importedFn()`）
 * 4. 本地同檔案宣告（函數、類別、箭頭函數變數）
 *
 * @param call    - CallExpression 節點
 * @param project - ts-morph Project 實例
 * @returns 被呼叫者的宣告節點，若找不到回傳 `null`
 */
function resolveCalleeDeclaration(call: any, project: Project): any {
  const expr = call.getExpression();
  const typeChecker = project.getTypeChecker();

  // 1. 優先使用 TypeChecker 解析 Symbol
  const symbol = expr.getSymbol();
  if (symbol) {
    const resolvedSymbol = getAliasedSymbol(symbol, typeChecker);
    if (resolvedSymbol) {
      const decls = resolvedSymbol.getDeclarations();
      if (decls.length > 0) return decls[0];
    }
  }

  // 2. 靜態 PropertyAccessExpression 解析（obj.method()）
  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    const decl = resolvePropertyAccessCallee(expr, project);
    if (decl) return decl;
  }

  // 3. 靜態 Import 追蹤（importedFn()）
  if (expr.getKind() === SyntaxKind.Identifier) {
    const name = expr.getText();
    const sourceFile = call.getSourceFile();
    const targetDecl = resolveImportTarget(sourceFile, name, project);
    if (targetDecl) return targetDecl;
  }

  // 4. 本地同檔案宣告（函數 / 類別 / 箭頭函數變數）
  if (expr.getKind() === SyntaxKind.Identifier) {
    const name = expr.getText();
    const sourceFile = call.getSourceFile();
    const fn = sourceFile.getFunction(name);
    if (fn) return fn;
    const cls = sourceFile.getClass(name);
    if (cls) return cls;
    const varDecl = sourceFile.getVariableDeclaration(name);
    if (varDecl) {
      const init = varDecl.getInitializer();
      if (
        init &&
        (init.getKind() === SyntaxKind.ArrowFunction ||
          init.getKind() === SyntaxKind.FunctionExpression)
      ) {
        return init;
      }
    }
  }

  return null;
}

// ── runGlobalReversePropagation ──────────────────────────────────────────────

/**
 * 全專案反向型別傳播（Reverse Propagation）。
 *
 * 遍歷所有非宣告檔原始碼中的 CallExpression，
 * 解析被呼叫目標的原始宣告（支援 default/named imports 跨檔案解析與靜態追蹤）。
 *
 * 傳播規則：
 * - 若被呼叫函數的參數尚未標記型別，或為 `{}`、`any` 等弱型別，
 *   則將呼叫站引數的型別反向寫入目標參數
 * - 針對 `this` 關鍵字，自動轉換為其所在 Class 的名稱
 * - 針對 `new ClassName()`，直接使用類別名稱
 * - 多個呼叫站的型別以 Union（` | `）形式合併
 *
 * 執行 2 輪迭代，確保因型別解析順序造成的依賴鏈能向下收斂傳播。
 *
 * @param project - ts-morph Project 實例
 */
export function runGlobalReversePropagation(project: Project) {
  const sourceFiles = project.getSourceFiles();

  for (let round = 1; round <= 2; round++) {
    console.log(`[Reverse Propagation] Starting Round ${round}...`);

    // 使用 Map<param, Set<typeText>> 收集所有呼叫站的觀察型別
    // 避免後者覆蓋前者，最終取 Union 型別
    const paramsToUpdate = new Map<any, Set<string>>();

    for (const sourceFile of sourceFiles) {
      if (sourceFile.isDeclarationFile()) continue;

      // 改用 getDescendantsOfKind 避免 tsquery 版本衝突靜默失敗
      const allCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      for (const call of allCalls) {
        // 解析呼叫目標的宣告節點
        const decl = resolveCalleeDeclaration(call, project);
        if (!decl) continue;

        // 只處理函數 / 方法 / 建構子 / 箭頭函數 / 函數表達式
        if (
          decl.getKind() === SyntaxKind.FunctionDeclaration ||
          decl.getKind() === SyntaxKind.MethodDeclaration ||
          decl.getKind() === SyntaxKind.Constructor ||
          decl.getKind() === SyntaxKind.ArrowFunction ||
          decl.getKind() === SyntaxKind.FunctionExpression
        ) {
          const targetFn = decl as any;
          const args = call.getArguments();
          const params = targetFn.getParameters();

          args.forEach((arg: any, idx: number) => {
            const param = params[idx];
            // 跳過不存在或解構參數（含 `{`）
            if (!param || param.getName().indexOf('{') !== -1) return;

            // 判斷是否需要更新：無型別標注、或是 {} / any / unknown 等弱型別
            const existingTypeNode = param.getTypeNode();
            const existingTypeText = existingTypeNode?.getText() ?? '';
            const isWeakType =
              !existingTypeNode ||
              existingTypeText === '{}' ||
              existingTypeText === 'any' ||
              existingTypeText === 'unknown';
            if (!isWeakType) return;

            // 推導引數的型別字串
            let argTypeText = '';

            if (arg.getKind() === SyntaxKind.ThisKeyword) {
              // `this` → 取所在 Class 的名稱
              const parentClass = arg.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
              if (parentClass && parentClass.getName()) {
                argTypeText = parentClass.getName()!;
              }
            } else if (arg.getKind() === SyntaxKind.NewExpression) {
              // `new ClassName(...)` → 直接用類別名稱（最可靠）
              argTypeText = (arg as any).getExpression().getText();
            } else {
              // 一般引數：透過 TypeChecker 推導
              const argType = arg.getType();
              argTypeText = getCleanTypeText(argType, project);
            }

            // 將有效型別加入 Set（同參數的多個呼叫站型別累積）
            if (
              argTypeText &&
              argTypeText !== 'any' &&
              argTypeText !== 'unknown' &&
              argTypeText !== '{}'
            ) {
              if (!paramsToUpdate.has(param)) {
                paramsToUpdate.set(param, new Set());
              }
              paramsToUpdate.get(param)!.add(argTypeText);
            }
          });
        }
      }
    }

    if (paramsToUpdate.size === 0) {
      console.log(`[Reverse Propagation] Round ${round} has no updates. Ending early.`);
      break;
    }

    console.log(`[Reverse Propagation] Round ${round} updating ${paramsToUpdate.size} parameters.`);

    for (const [param, typeSet] of paramsToUpdate.entries()) {
      try {
        // 多呼叫站型別取 union；單一型別直接用
        const typeText = Array.from(typeSet).join(' | ');
        param.setType(typeText);
      } catch (e) {
        // 忽略個別參數寫入失敗（如已刪除節點）
      }
    }
  }
}

// ── runGlobalForwardPropagation ──────────────────────────────────────────────

/**
 * 全專案局部變數正向型別傳播（Forward Propagation）。
 *
 * 遍歷所有非宣告檔中的 VariableDeclaration，
 * 推導其 Initializer 的型別並為其標注。
 *
 * 推導策略：
 * 1. `new ClassName()` → 直接用類別名稱（最可靠，不依賴 TypeChecker）
 * 2. `arr[i]` (ElementAccessExpression) → 呼叫 `getArrayElementType()` 取元素型別
 * 3. 一般 initializer → 透過 TypeChecker 的 `getType()` 推導
 *
 * 執行 3 輪迭代，確保多層依賴鏈（如 `lines → line → staff → voice`）能順利收斂傳播。
 *
 * @param project - ts-morph Project 實例
 */
export function runGlobalForwardPropagation(project: Project) {
  const sourceFiles = project.getSourceFiles();

  for (let round = 1; round <= 3; round++) {
    // 收集本輪需要更新的變數宣告與推導型別
    const varsToUpdate = new Map<any, string>();

    for (const sourceFile of sourceFiles) {
      if (sourceFile.isDeclarationFile()) continue;

      // 改用 getDescendantsOfKind 避免 tsquery 版本衝突
      const allVarDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      for (const decl of allVarDecls) {
        // 跳過已有型別標注的宣告
        if (typeof (decl as any).getTypeNode === 'function' && (decl as any).getTypeNode()) continue;

        // 跳過解構宣告（非簡單識別子）
        const nameNode = decl.getNameNode();
        if (nameNode.getKind() !== SyntaxKind.Identifier) continue;

        const init = decl.getInitializer();
        if (!init) continue;

        let typeText = '';

        if (init.getKind() === SyntaxKind.NewExpression) {
          // `new ClassName()` → 直接取類別名稱，最可靠
          typeText = (init as any).getExpression().getText();
        } else if (init.getKind() === SyntaxKind.ElementAccessExpression) {
          // `arr[i]` → 取陣列元素型別（如 `Lines[]` → `Lines`）
          const arrType = (init as any).getExpression().getType();
          const elemType = arrType.getArrayElementType?.();
          if (elemType) {
            typeText = getCleanTypeText(elemType, project);
          }
        } else {
          // 一般 initializer：透過 TypeChecker 推導
          const type = init.getType();
          typeText = getCleanTypeText(type, project);
        }

        if (typeText && typeText !== 'any' && typeText !== 'unknown') {
          varsToUpdate.set(decl, typeText);
        }
      }
    }

    if (varsToUpdate.size === 0) break;

    for (const [decl, typeText] of varsToUpdate.entries()) {
      try {
        decl.setType(typeText);
      } catch (e) {
        // 忽略個別宣告寫入失敗
      }
    }
  }
}

// ── runGlobalReturnTypePropagation ───────────────────────────────────────────

/**
 * 全專案函數與方法回傳值型別推導與注入（Return Type Propagation）。
 *
 * 遍歷所有非宣告檔中的：
 * - Class 的所有方法（MethodDeclaration）
 * - 一般函數宣告（FunctionDeclaration）
 * - 變數宣告的箭頭函數 / 函數表達式（ArrowFunction / FunctionExpression）
 *
 * 並對每個函數呼叫 `resolveAndSetReturnType` 推導並注入回傳型別。
 *
 * @param project        - ts-morph Project 實例
 * @param typeDB         - 側錄型別資料庫（來自 tracker）
 * @param config         - 重構主配置參數物件
 * @param fileInterfaces - 各檔案的 Shape Interface 暫存映射（檔案路徑 → 介面 Map）
 * @param inDir          - 輸入的源碼目錄（用於計算相對路徑）
 */
export function runGlobalReturnTypePropagation(
  project: Project,
  typeDB: any,
  config: any,
  fileInterfaces: Map<string, Record<string, string>>,
  inDir: string
) {
  const sourceFiles = project.getSourceFiles();
  const typeChecker = project.getTypeChecker();

  for (const sourceFile of sourceFiles) {
    if (sourceFile.isDeclarationFile()) continue;

    const relPath = path.relative(inDir, sourceFile.getFilePath()).replace(/\\/g, '/');

    // 確保此檔案的 interfacesToDeclare 已存在（若無則建立空物件）
    let interfacesToDeclare = fileInterfaces.get(sourceFile.getFilePath());
    if (!interfacesToDeclare) {
      interfacesToDeclare = {};
      fileInterfaces.set(sourceFile.getFilePath(), interfacesToDeclare);
    }

    // 收集本檔案所有需要推導回傳型別的函數節點
    const allFns: any[] = [];

    // Class 方法
    sourceFile.getClasses().forEach(cls => {
      cls.getMethods().forEach(m =>
        allFns.push({ node: m, name: `${cls.getName()}.${m.getName()}` })
      );
    });

    // 一般函數宣告
    sourceFile.getFunctions().forEach(fn => {
      allFns.push({ node: fn, name: fn.getName() || 'anonymous' });
    });

    // 箭頭函數 / 函數表達式（來自變數宣告）
    // 算法：進入每個變數宣告節點，判斷其 initializer 是否為 ArrowFunction / FunctionExpression
    sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(decl => {
        const init = decl.getInitializer();
        if (
          init &&
          (init.getKind() === SyntaxKind.ArrowFunction ||
            init.getKind() === SyntaxKind.FunctionExpression)
        ) {
        allFns.push({ node: init, name: decl.getName() });
      }
    });

    // 對每個函數節點推導並注入回傳型別
    for (const fnItem of allFns) {
      resolveAndSetReturnType(
        fnItem.node,
        fnItem.name,
        relPath,
        typeDB,
        interfacesToDeclare,
        config,
        typeChecker
      );
    }
  }
}

// ── writeInterfaceDeclarations ────────────────────────────────────────────────

/**
 * 將收集到的所有 Shape Interface 宣告寫入指定 SourceFile。
 *
 * 插入位置：最後一個 import 宣告之後（若有），否則插入在檔案開頭。
 * 這樣可確保 Interface 宣告出現在 import 後、程式碼前的正確位置。
 *
 * @param sourceFile          - 目標 ts-morph SourceFile 節點
 * @param interfacesToDeclare - 待寫入的 Interface 名稱 → 宣告字串的映射物件
 */
export function writeInterfaceDeclarations(
  sourceFile: SourceFile,
  interfacesToDeclare: Record<string, string>
) {
  const interfaceDeclarations = Object.values(interfacesToDeclare).join('\n\n');
  if (interfaceDeclarations) {
    const imports = sourceFile.getImportDeclarations();
    if (imports.length > 0) {
      // 插入在最後一個 import 宣告之後
      const lastImport = imports[imports.length - 1];
      sourceFile.insertText(lastImport.getEnd(), '\n\n' + interfaceDeclarations + '\n');
    } else {
      // 無 import：插入在檔案開頭
      sourceFile.insertText(0, interfaceDeclarations + '\n\n');
    }
  }
}
