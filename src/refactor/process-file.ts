/**
 * @file process-file.ts
 * @description
 * 單一 JavaScript → TypeScript 檔案的 AST 重構核心管線。
 *
 * 主要功能（由 `processFileRefactoring` 函式執行）：
 * 1. 清理現有參數型別與 Interface 宣告
 * 2. 執行 `refactorCjsToEsm`：CommonJS → ESM 語法轉換
 * 3. 為一般函數、類別方法、建構子及箭頭函數注入參數型別
 * 4. 自動提升 Class 建構子中的 `this.xxx = yyy` 為類別欄位宣告（Field Declarations）
 * 5. 補齊漏掉的 Class 屬性，防範 TS2339 未宣告屬性錯誤
 * 6. 若有對應 d.ts 介面，從中查詢並套用屬性型別
 */

import * as path from 'path';
import { Project, SyntaxKind, SourceFile, TypeChecker } from 'ts-morph';
import {
  findInterfaceInProject,
  getPropertyTypeString,
  safeAddProperty,
  cleanCommentToJSDoc,
} from './type-utils';
import { annotateFunction, refactorCjsToEsm } from './annotate';

// ── processFileRefactoring ───────────────────────────────────────────────────

/**
 * 執行單一 JavaScript 檔案至 TypeScript 檔案的 AST 重構核心管線。
 *
 * 整體管線步驟：
 * 1. 清除既有的 Interface 宣告與所有參數型別（重構前先歸零）
 * 2. 呼叫 `refactorCjsToEsm` 完成 CommonJS → ESM 語法轉換
 * 3. 為一般函數（FunctionDeclaration）標注參數型別
 * 4. 為每個 Class 執行：
 *    a. 掃描建構子中所有 `this.xxx = yyy` 的安全靜態常數，提升為類別欄位
 *    b. 移除已提升的建構子內賦值語句（去重）
 *    c. 補齊其他 this 賦值中漏宣告的屬性（防 TS2339）
 *    d. 為所有方法與建構子標注參數型別（結合 d.ts + typeDB）
 *    e. 若有對應 d.ts 介面，同步屬性型別
 *
 * @param sourceFile          - ts-morph SourceFile 原始碼節點
 * @param typeChecker         - TypeChecker 實例（用於精確型別查詢）
 * @param typeDB              - 側錄型別資料庫（來自 tracker）
 * @param config              - 重構主配置參數物件
 * @param inDir               - 輸入的源碼目錄（用於計算相對路徑）
 * @param project             - ts-morph Project 專案實例
 * @param interfacesToDeclare - 用於收集待寫入 Interface 的暫存映射物件
 */
export function processFileRefactoring(
  sourceFile: SourceFile,
  typeChecker: TypeChecker,
  typeDB: any,
  config: any,
  inDir: string,
  project: Project,
  interfacesToDeclare: Record<string, string>
): void {
  // 計算相對路徑，作為 typeDB 的 Key 前綴
  const relPath = path.relative(inDir, sourceFile.getFilePath()).replace(/\\/g, '/');

  // ── 步驟 1：清除既有 Interface 宣告與所有參數型別 ────────────────────────
  // 目的：確保每次重構都從乾淨的狀態開始，不受舊版殘留型別影響
  sourceFile.getInterfaces().forEach(iface => iface.remove());

  sourceFile.getDescendantsOfKind(SyntaxKind.Parameter).forEach(param => {
    param.removeType();
  });

  // ── 步驟 2：CommonJS → ESM 語法轉換 ─────────────────────────────────────
  refactorCjsToEsm(sourceFile);

  // ── 步驟 3：標注一般 FunctionDeclaration 的參數型別 ─────────────────────
  // 改用 ts-morph 原生 API（tsquery 有版本衝突，靜默失敗）
  const functions = sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  for (const fn of functions) {
    const fnName = fn.getName() || 'anonymous';
    // 先清除回傳型別，讓後續階段重新推導
    if (typeof fn.removeReturnType === 'function') fn.removeReturnType();
    annotateFunction(fn, fnName, relPath, typeDB, interfacesToDeclare, config, undefined, typeChecker);
  }

  // ── 步驟 4：處理每個 ClassDeclaration ───────────────────────────────────
  // 改用 ts-morph 原生 API（tsquery 有版本衝突，靜默失敗）
  const classes = sourceFile.getDescendantsOfKind(SyntaxKind.ClassDeclaration);

  // 用於在 class loop 結束後一次性清理磥留的孤立注解（stmt.remove() 不移除 leading trivia）
  const movedComments: string[] = [];

  for (const cls of classes) {
    const className = cls.getName();

    // 嘗試在 d.ts 中找到同名介面（用於參數與屬性型別對照）
    const dtsInterface = className ? findInterfaceInProject(project, className) : undefined;

    // 收集此 Class 所有方法名（用於判斷 this.xxx 是否為方法）
    const classMethods = new Set(cls.getMethods().map((m: any) => m.getName()));

    // ── 4a：收集所有 this 賦值的屬性名（來自整個類別，非只限建構子）──────
    // 用 getDescendantsOfKind 找所有 BinaryExpression，再手動過濾 this.xxx = yyy
    const properties = new Set<string>();
    const allBinaries = cls.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    const thisAssignments = allBinaries.filter(b =>
      b.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
      b.getLeft().getKind() === SyntaxKind.PropertyAccessExpression &&
      (b.getLeft() as any).getExpression().getKind() === SyntaxKind.ThisKeyword
    );
    for (const binaryExpr of thisAssignments) {
      const left = binaryExpr.getLeft() as any;
      const name = left.getName();
      if (name !== 'constructor') {
        properties.add(name);
      }
    }

    // ── 4b：處理建構子中的 this.xxx = yyy 提升 ──────────────────────────
    const ctor = cls.getConstructors()[0];
    if (ctor) {
      const ctorParams = ctor.getParameters().map((p: any) => p.getName());

      // 收集建構子內所有的局部變數名（避免提升含局部變數的賦值）
      // 改用 ts-morph 原生 API，避免 tsquery 版本衝突靜默失敗
      const localVars = new Set<string>();
      const ctorLocalDecls = ctor.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      for (const decl of ctorLocalDecls) {
        localVars.add(decl.getName());
      }

      // 收集可安全提升的屬性（rightText 不依賴建構子參數或局部變數）
      const propertiesToMigrate: { propName: string; rightText: string; commentText: string; trailingComment: string }[] = [];
      const collectedPropNames = new Set<string>();

      // 同樣改用 getDescendantsOfKind 避免 tsquery 版本衝突
      const ctorBinaries = ctor.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const ctorAssignments = ctorBinaries.filter(b =>
        b.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
        b.getLeft().getKind() === SyntaxKind.PropertyAccessExpression &&
        (b.getLeft() as any).getExpression().getKind() === SyntaxKind.ThisKeyword
      );

      for (const binary of ctorAssignments) {
        const stmt = binary.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
        // 只處理建構子 body 直接子語句（不處理嵌套 if 內的賦值）
        // 注意：tsquery 包裝的節點每次可能回傳不同物件，不能用 !== 做參考比較，
        // 改用 getPos() 比較位置，或檢查 parent 的 kind 是否為建構子的 Block
        const ctorBody = ctor.getBody();
        if (!stmt || !ctorBody) continue;
        // 確認 stmt 的直接 parent 是 ctorBody（Block），而非嵌套 if/else 等區塊
        const stmtParent = stmt.getParent();
        if (
          !stmtParent ||
          stmtParent.getKind() !== SyntaxKind.Block ||
          stmtParent.getPos() !== ctorBody.getPos()
        ) continue;

        const left = binary.getLeft() as any;
        const right = binary.getRight();
        const propName = left.getName();
        const rightText = right.getText();

        // 跳過：已是方法 / 已收集過 / 含有 this 參考（尚未初始化）
        if (classMethods.has(propName)) continue;
        if (collectedPropNames.has(propName)) continue;
        if (rightText.includes('this.')) continue;

        // 安全性檢查：rightText 不得含有建構子參數或局部變數
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
          // 收集前導注解（Leading Comment Ranges）
          const leadingCommentRanges = stmt.getLeadingCommentRanges();
          let commentText = '';
          if (leadingCommentRanges && leadingCommentRanges.length > 0) {
            commentText = leadingCommentRanges.map((r: any) => r.getText()).join('\n');
          }

          // 收集行尾 inline 注解（Trailing Comment Ranges），例如 "// 每個 step 的毫秒數"
          const trailingCommentRanges = stmt.getTrailingCommentRanges();
          let trailingComment = '';
          if (trailingCommentRanges && trailingCommentRanges.length > 0) {
            trailingComment = trailingCommentRanges.map((r: any) => r.getText()).join(' ');
          }

          collectedPropNames.add(propName);
          propertiesToMigrate.push({ propName, rightText, commentText, trailingComment });
        }
      }

      // ── 4c：批次插入類別欄位宣告 ─────────────────────────────────────
      const propertiesStructures = propertiesToMigrate.map(item => {
        // 嘗試從 d.ts 取得屬性型別
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
        // 合併 leading block comment 與 trailing inline comment 為 JSDoc
        const allComments = [item.commentText, item.trailingComment].filter(Boolean).join('\n');
        if (allComments) {
          struct.docs = [cleanCommentToJSDoc(allComments)];
        }
        return struct;
      });

      if (propertiesStructures.length > 0) {
        cls.insertProperties(0, propertiesStructures);
      }

      // ── 4d：從 properties Set 中移除已提升的屬性 ─────────────────────
      propertiesToMigrate.forEach(item => {
        properties.delete(item.propName);
      });

      // ── 4e：移除建構子中已提升的 this.xxx = yyy 語句 ─────────────────
      // 使用 stmt.remove() （不會使其他節點失效）
      // 前導注解的清理待 class loop 結束後由 movedComments 陣列統一處理
      const migratedPropsSet = new Set(propertiesToMigrate.map(x => x.propName));

      // 收集已移動的前導注解文字，供後續清理
      propertiesToMigrate.forEach(item => {
        if (item.commentText) {
          // commentText 可能含多行，拆分後分別加入
          item.commentText.split('\n').forEach(line => {
            const t = line.trim();
            if (t) movedComments.push(t);
          });
        }
      });

      // 從後往前依序移除語句（不包含前導注解）
      const currentStatements = ctor.getStatements();
      for (let i = currentStatements.length - 1; i >= 0; i--) {
        const stmt = currentStatements[i] as any;
        if (stmt.getKind() !== SyntaxKind.ExpressionStatement) continue;
        const expr = stmt.getExpression();
        if (expr.getKind() !== SyntaxKind.BinaryExpression) continue;
        const left = expr.getLeft() as any;
        if (
          left.getKind() !== SyntaxKind.PropertyAccessExpression ||
          expr.getOperatorToken().getText() !== '=' ||
          left.getExpression().getKind() !== SyntaxKind.ThisKeyword
        ) continue;
        const propName = left.getName();
        if (migratedPropsSet.has(propName)) {
          stmt.remove(); // 僅移除語句本身，保留前導注解（稍後清理）
        }
      }
    }

    // ── 4f：補齊其他 this 賦值中漏宣告的屬性（防 TS2339）────────────────
    const existingProps = new Set(cls.getProperties().map(p => p.getName()));

    properties.forEach(prop => {
      if (!existingProps.has(prop) && !classMethods.has(prop)) {
        let propType = 'any';
        // 嘗試從 d.ts 取得精確型別
        if (dtsInterface) {
          const dtsProp = dtsInterface.getProperty(prop);
          if (dtsProp) {
            propType = getPropertyTypeString(dtsProp);
          }
        }
        safeAddProperty(cls, prop, propType);
      }
    });

    // ── 4g：為所有方法標注參數型別 ───────────────────────────────────────
    cls.getMethods().forEach((method: any) => {
      const fnName = method.getName();
      if (typeof method.removeReturnType === 'function') method.removeReturnType();
      annotateFunction(
        method,
        `${cls.getName()}.${fnName}`,
        relPath,
        typeDB,
        interfacesToDeclare,
        config,
        dtsInterface,
        typeChecker
      );
    });

    // ── 4h：為建構子標注參數型別 ─────────────────────────────────────────
    cls.getConstructors().forEach((ctor: any) => {
      annotateFunction(
        ctor,
        `${cls.getName()}.constructor`,
        relPath,
        typeDB,
        interfacesToDeclare,
        config,
        dtsInterface,
        typeChecker
      );
    });

    // ── 4i：從 d.ts 同步類別屬性型別 ────────────────────────────────────
    if (dtsInterface) {
      cls.getProperties().forEach((prop: any) => {
        const propName = prop.getName();
        const dtsProp = dtsInterface.getProperty(propName);
        if (dtsProp) {
          const dtsTypeStr = getPropertyTypeString(dtsProp);
          const currentType = prop.getTypeNode()?.getText() || '';
          // 只在無型別或弱型別（any）時才套用 d.ts 型別
          if (!currentType || currentType === 'any' || currentType.includes('any')) {
            prop.setType(dtsTypeStr);
          }
        }
      });
    }

    // 注：回傳型別標注統一在後續的全域 Stage 3 進行，此處不處理
  }

  // ── 後處理：清理 constructor 內殘留的孤立注解行 ─────────────────────────
  // stmt.remove() 不移除 leading trivia，已移至 class 欄位 JSDoc 的注解會殘留
  // 所有 class 處理完成後，一次性用文字替換移除這些特定注解行
  if (movedComments.length > 0) {
    let text = sourceFile.getFullText();
    const originalText = text;
    for (const comment of movedComments) {
      const trimmed = comment.trim();
      if (!trimmed) continue;
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 移除該注解行（包含前導空白與換行符）
      text = text.replace(new RegExp('[ \\t]*' + escaped + '[ \\t]*(?:\\r?\\n|$)', 'g'), '');
    }
    if (text !== originalText) {
      sourceFile.replaceWithText(text);
    }
  }
}
