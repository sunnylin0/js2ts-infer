/**
 * @file tsquery-ext.ts
 * @description
 * 為 ts-morph 的 Node 原型注入 `.query()` 方法，
 * 讓所有 ts-morph 節點可以使用 tsquery 選擇器語法進行 AST 查詢。
 *
 * ⚠️  本模組僅有 Side-Effect（副作用），不匯出任何值。
 *     必須在其他模組之前最先被 import，以確保 prototype patch 已生效。
 */

import { Node, ts } from 'ts-morph';
import { tsquery } from '@phenomnomnominal/tsquery';

// ── ts-morph 版本衝突修補 ─────────────────────────────────────────────────────
// 強制讓 require cache 中的 typescript 指向 ts-morph 所使用的版本，
// 防止 tsquery 與 ts-morph 之間因版本不同而產生 Node 型別不匹配的問題。
try {
  require.cache[require.resolve('typescript')] = {
    exports: ts
  } as any;
} catch (e) {}

// ── 宣告模組擴充（Module Augmentation）──────────────────────────────────────
declare module 'ts-morph' {
  interface Node {
    /** 使用 tsquery CSS 選擇器語法在目前節點的子樹中查詢符合的 ts-morph 節點。 */
    query(selector: string): any[];
  }
}

// ── 注入 Node.prototype.query ────────────────────────────────────────────────
// 透過 tsquery 查詢 compiler AST 節點後，再透過 compilerFactory 包裝回 ts-morph 物件。
(Node.prototype as any).query = function (this: Node, selector: string): any[] {
  const compilerNode = this.compilerNode || this;
  const sourceFile = this.getSourceFile();
  const matches = tsquery(compilerNode as any, selector);
  return matches.map(n =>
    (sourceFile as any)._context.compilerFactory.getNodeFromCompilerNode(n, sourceFile)
  );
};

/**
 * 在指定的 ts-morph 節點子樹中，以 tsquery 選擇器查詢並回傳所有符合節點。
 *
 * @param node     - 欲查詢的起始節點（任意 ts-morph 節點）
 * @param selector - tsquery CSS 選擇器字串（如 `'CallExpression'`）
 * @returns 符合選擇器的 ts-morph 節點陣列
 */
export function query(node: any, selector: string): any[] {
  return node.query(selector);
}
