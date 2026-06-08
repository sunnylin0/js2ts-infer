/**
 * @file annotate.ts
 * @description
 * 函數參數型別標注（Annotation）與 CJS → ESM 重構模組。
 *
 * 包含以下功能：
 * - `annotateFunction`：為函數參數注入 TypeScript 型別（結合 d.ts 宣告與 typeDB 側錄）
 * - `resolveAndSetReturnType`：推導並標注函數回傳值型別
 * - `refactorCjsToEsm`：將 CommonJS 語法（require/exports）重構為 ESM 語法（import/export）
 */

import { SourceFile, SyntaxKind, TypeChecker, VariableDeclarationKind } from 'ts-morph';
import {
  resolveParameterType,
  getCleanTypeText,
} from './type-utils';

// ── annotateFunction ─────────────────────────────────────────────────────────

/**
 * 為指定函數的參數進行 TypeScript 型別標注（Annotation）。
 *
 * 處理流程：
 * 1. 取得函數參數列表
 * 2. 比對對應的 d.ts 宣告型別，若有高信賴型別優先套用
 * 3. 若無 d.ts 資訊，查詢 `typeDB` 中該參數的側錄記錄
 * 4. 側錄呼叫次數大於信賴閾值時，呼叫 `resolveParameterType` 推導型別並標注
 * 5. 側錄次數不足時，標記為低信賴度 any（`/* @inferred-low-confidence * / any`）
 *
 * @param fnNode              - 函數宣告或方法節點
 * @param fnName              - 函數識別名稱（含類別前綴，如 `MyClass.myMethod`）
 * @param relPath             - 目前檔案的專案相對路徑
 * @param typeDB              - 記憶體型別側錄資料庫
 * @param interfacesToDeclare - 用於收集待聲明 Interface 的暫存映射物件
 * @param config              - 主設定檔配置物件
 * @param dtsInterface        - 同名類別在 d.ts 中的介面定義節點（可選）
 * @param typeChecker         - TypeChecker 實例（可選，用於更精確的型別解析）
 */
export function annotateFunction(
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

  // 取函數短名稱（不含類別前綴），用來在 d.ts 介面中查方法簽章
  const shortFnName = fnName.includes('.') ? fnName.split('.').pop()! : fnName;
  let dtsMethodOrType: any = undefined;

  if (dtsInterface && shortFnName) {
    // 嘗試以方法簽章或方法形式取得 d.ts 宣告
    if (typeof dtsInterface.getMethodSignature === 'function') {
      dtsMethodOrType = dtsInterface.getMethodSignature(shortFnName);
    } else if (typeof dtsInterface.getMethod === 'function') {
      dtsMethodOrType = dtsInterface.getMethod(shortFnName);
    }

    // 若找不到方法，嘗試從屬性中找函數型別
    if (!dtsMethodOrType) {
      const dtsProp = dtsInterface.getProperty(shortFnName);
      if (dtsProp) {
        const typeNode = dtsProp.getTypeNode();
        if (
          typeNode &&
          (typeNode.getKind() === SyntaxKind.FunctionType ||
            typeNode.getKind() === SyntaxKind.TypeLiteral)
        ) {
          dtsMethodOrType = typeNode;
        }
      }
    }
  }

  // ── 逐一處理每個參數 ────────────────────────────────────────────────────
  params.forEach((param: any, paramIdx: number) => {
    const paramName = param.getName();

    // 1. 嘗試從 d.ts 取得精確型別
    let dtsParamTypeStr: string | undefined = undefined;
    if (dtsMethodOrType) {
      if (
        dtsMethodOrType.getKind() === SyntaxKind.MethodSignature ||
        dtsMethodOrType.getKind() === SyntaxKind.FunctionType
      ) {
        const dtsParams = dtsMethodOrType.getParameters();
        // 優先按名稱配對，備援按位置配對
        const dtsParam =
          dtsParams.find((p: any) => p.getName() === paramName) || dtsParams[paramIdx];
        if (dtsParam) {
          const typeNode = dtsParam.getTypeNode();
          if (typeNode) {
            dtsParamTypeStr = typeNode.getText();
          }
        }
      }
    }

    if (dtsParamTypeStr && dtsParamTypeStr !== 'any') {
      // d.ts 有精確型別：直接套用（僅在無型別標注且非解構參數時）
      if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
        param.setType(dtsParamTypeStr);
      }
    } else {
      // 2. 查詢 typeDB 側錄
      const trackerId = `${relPath}::${fnName}::param::${paramName}`;
      const record = typeDB[trackerId];

      if (record && record.callCount >= confidenceThreshold) {
        // 信賴度足夠：推導型別並標注
        const sanitizedFnName = fnName.replace(/\./g, '');
        const baseName = `${sanitizedFnName.charAt(0).toUpperCase()}${sanitizedFnName.slice(1)}${paramName.charAt(0).toUpperCase()}${paramName.slice(1)}`;
        const typeStr = resolveParameterType(record, baseName, interfacesToDeclare, fnNode.getProject());

        if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
          param.setType(typeStr);
        }
      } else if (record && record.callCount > 0) {
        // 信賴度不足：標注為低信賴度 any
        if (!param.getTypeNode() && paramName.indexOf('{') === -1) {
          param.setType('/* @inferred-low-confidence */ any');
        }
      }
    }
  });

  // ── 回傳型別：從 d.ts 取得 ───────────────────────────────────────────────
  let dtsReturnTypeStr: string | undefined = undefined;
  if (dtsMethodOrType) {
    if (
      dtsMethodOrType.getKind() === SyntaxKind.MethodSignature ||
      dtsMethodOrType.getKind() === SyntaxKind.FunctionType
    ) {
      const returnTypeNode = dtsMethodOrType.getReturnTypeNode();
      if (returnTypeNode) {
        dtsReturnTypeStr = returnTypeNode.getText();
      }
    }
  }

  // 若 d.ts 有非 any/void 的回傳型別且函數尚未標注，套用之
  if (dtsReturnTypeStr && dtsReturnTypeStr !== 'any' && dtsReturnTypeStr !== 'void') {
    if (typeof fnNode.setReturnType === 'function' && !fnNode.getReturnTypeNode()) {
      fnNode.setReturnType(dtsReturnTypeStr);
    }
  }
}

// ── resolveAndSetReturnType ──────────────────────────────────────────────────

/**
 * 推導並設定函數或方法的回傳值型別。
 *
 * 處理流程：
 * 1. 優先透過 ts-morph 靜態 AST 分析 ReturnStatement，推導並寬化回傳值
 * 2. 若推導結果為 `'{}'` 或空字串，手動收集所有 return 表達式的型別
 * 3. 若 AST 無法推導，查詢 `typeDB` 中的回傳側錄作為兜底
 *
 * @param fnNode              - 函數或方法節點
 * @param fnName              - 函數識別名稱
 * @param relPath             - 目前檔案的相對路徑
 * @param typeDB              - 記憶體型別側錄資料庫
 * @param interfacesToDeclare - 用於收集待聲明 Interface 的暫存映射物件
 * @param config              - 主設定檔配置物件
 * @param typeChecker         - TypeChecker 實例（可選）
 */
export function resolveAndSetReturnType(
  fnNode: any,
  fnName: string,
  relPath: string,
  typeDB: any,
  interfacesToDeclare: Record<string, string>,
  config: any,
  typeChecker?: TypeChecker
) {
  // 不支援 setReturnType 或已有回傳型別標注的節點跳過
  if (
    !fnNode ||
    typeof fnNode.setReturnType !== 'function' ||
    typeof fnNode.getReturnType !== 'function' ||
    fnNode.getReturnTypeNode()
  ) {
    return;
  }

  // 1. 優先嘗試 AST 推導
  const returnType = fnNode.getReturnType();
  let returnTypeText = getCleanTypeText(returnType, fnNode.getProject());

  // 若型別被 widen 為 '{}' 或為空，手動收集 return 表達式型別防止過度簡化
  if (returnTypeText === '{}' || returnTypeText === '') {
    const returnStatements = fnNode.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    if (returnStatements.length > 0) {
      const types = new Set<string>();
      returnStatements.forEach((ret: any) => {
        const expr = ret.getExpression();
        if (expr) {
          const exprType = expr.getType();
          const exprTypeText = getCleanTypeText(exprType, fnNode.getProject());
          if (exprTypeText) {
            types.add(exprTypeText);
          } else {
            // 若回傳 `{}`，如實記錄
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

  // 2. AST 無法推導有效型別：使用 typeDB 兜底
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

// ── refactorCjsToEsm ─────────────────────────────────────────────────────────

/**
 * 將檔案中的 CommonJS 模組語法重構為標準 ESM 模組語法。
 *
 * 支援轉換：
 * - `const foo = require('...')` → `import foo from '...'`
 * - `const { a, b } = require('...')` → `import { a, b } from '...'`
 * - `module.exports = ...` → `export default ...`
 * - `module.exports.foo = ...` / `exports.foo = ...` → `export const foo = ...`
 *
 * @param sourceFile - ts-morph SourceFile 原始碼檔案節點（直接修改 AST，無回傳值）
 */
export function refactorCjsToEsm(sourceFile: SourceFile) {
  // ── 處理 require() 呼叫 ───────────────────────────────────────────────────
  const requireCalls = sourceFile.query('CallExpression[expression.name="require"]');

  for (const call of requireCalls) {
    const decl = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (!decl) continue;

    const stmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    // 只處理頂層的 require 語句（父節點為 SourceFile）
    if (!stmt || stmt.getParent().getKind() !== SyntaxKind.SourceFile) continue;

    if (call.getArguments().length === 1) {
      const moduleSpecifier = call.getArguments()[0].getText().replace(/['"]/g, '');
      const nameNode = decl.getNameNode();
      const isDestructured = nameNode.getKind() === SyntaxKind.ObjectBindingPattern;

      if (isDestructured) {
        // `const { a, b } = require(...)` → named imports
        const elements = nameNode.getElements().map((el: any) => el.getName());
        sourceFile.addImportDeclaration({
          namedImports: elements,
          moduleSpecifier: moduleSpecifier
        });
      } else {
        // `const foo = require(...)` → default import
        sourceFile.addImportDeclaration({
          defaultImport: decl.getName(),
          moduleSpecifier: moduleSpecifier
        });
      }
      stmt.remove();
    }
  }

  // ── 處理 module.exports / exports.xxx 賦值 ───────────────────────────────
  const binaryAssignments = sourceFile.query(
    `BinaryExpression[operatorToken.kind=${SyntaxKind.EqualsToken}]`
  );

  for (const binary of binaryAssignments) {
    const stmt = binary.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
    if (!stmt || stmt.getParent().getKind() !== SyntaxKind.SourceFile) continue;

    const left = binary.getLeft();
    const right = binary.getRight();
    const leftText = left.getText();

    if (leftText === 'module.exports') {
      // `module.exports = X` → `export default X`
      sourceFile.addExportAssignment({
        isExportEquals: false,
        expression: right.getText()
      });
      stmt.remove();
    } else if (leftText.startsWith('module.exports.')) {
      // `module.exports.foo = X` → `export const foo = X`
      const propName = leftText.replace('module.exports.', '');
      sourceFile.addVariableStatement({
        declarationKind: VariableDeclarationKind.Const,
        declarations: [{ name: propName, initializer: right.getText() }],
        isExported: true
      });
      stmt.remove();
    } else if (leftText.startsWith('exports.')) {
      // `exports.foo = X` → `export const foo = X`
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
