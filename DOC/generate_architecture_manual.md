# js2ts-infer 重構核心（cli generate）極致硬核開發者手冊

本手冊旨在為核心重構模組（`commands/generate.ts`、`code-generator.ts`、`ast-refactorer.ts`）提供編譯器層級的架構、資料流向與 AST 轉換邏輯之技術說明書。

---

## 1. 系統設計哲學與混合型別推導架構

`js2ts-infer` 的核心設計思想在於解決傳統靜態分析工具在動態語言（JavaScript）中無法精確識別物件結構（Object Shapes）與動態回呼（Callbacks）型別的技術痛點。工具採用了**動態側錄（Runtime Profiling）與靜態編譯器語意分析（Static Semantic Analysis）的雙軌混合機制**。

在進行 `generate` 時，型別的推導與注入遵循嚴格的**優先級對齊原則（Priority Hierarchy）**，如下所示：

```
┌────────────────────────────────────────────────────────┐
│               第一順位：宣告檔對齊 (d.ts)               │
│  讀取專案內既有 *.d.ts Interface 定義，優先保障型別精準度   │
└───────────────────────────┬────────────────────────────┘
                            │ (若無定義或為 any)
                            ▼
┌────────────────────────────────────────────────────────┐
│               第二順位：AST 語意靜態推導                 │
│  透過 ts-morph 靜態分析區域變數初始化、函式回傳值等語意    │
└───────────────────────────┬────────────────────────────┘
                            │ (若推導出 any/空值)
                            ▼
┌────────────────────────────────────────────────────────┐
│             第三順位：動態側錄 Shape 兜底 (typeDB)      │
│  利用運行期插樁側錄 (types-observed.json) 的 Shape 結構   │
└────────────────────────────────────────────────────────┘
```

---

## 2. 核心重構管道流程 (The Codemod Pipeline)

重構 Pipeline 分為以下七個物理階段：

### 階段 1：環境前置檢查與設定檔載入
1. 解析命令列參數（`inDir`、`outDir`、`config`、`dryRun`、`force`）。
2. 若未設置 `--force` 且不為 `--dry-run`，則同步調用 `git status --porcelain` 檢查工作區是否乾淨，防範代碼被非預期修改。
3. 讀取並合併 `js2ts.config.json` 與 `types-observed.json`（載入記憶體作為 `typeDB`）。

### 階段 2：AST 預熱與型別字典建置
1. 初始化 `ts-morph` `Project` 實例。
2. 使用 `globSync` 搜尋並加載專案下所有的 `*.d.ts` 宣告檔。此時，TypeScript Compiler 的 `TypeChecker` 將會建立完整的全域符號表（Symbol Table）與命名空間型別地圖。

### 階段 3：AST 結構轉換（CJS 轉 ESM）
1. 建立對應的 `.ts` 虛擬 AST。
2. 清理現有參數型別與 Interface。
3. 執行 `refactorCjsToEsm` 進行語法變更：
   - 將 `const { x } = require('mod')` 轉為 `import { x } from 'mod'`。
   - 將 `module.exports = x` 轉為 `export default x`。
   - 將 `exports.y = z` 轉為 `export const y = z`。

### 階段 4：類別屬性重構與 Fields Hoisting
為了防止 TypeScript 編譯器對未宣告的類別屬性報錯（`TS2339`），執行雙階段 Codemod：
- **收集階段**：遍歷建構子（Constructor），靜態收集 `this.xxx = yyy` 語句，並與當前類別方法、區域變數、建構子參數進行相依性安全性比對。
- **寫入階段**：優先與 `.d.ts` 介面對齊型別，隨後呼叫 `cls.insertProperties(0, ...)` 將屬性提升宣告至類別最頂端。最後逆序移除建構子中已被提升宣告的賦值陳述式。

### 階段 5：函式參數與回傳值標註
1. 遍歷一般函式、箭頭函式與類別方法。
2. 呼叫 `annotateFunction` 標註參數。若 `.d.ts` 有簽章，優先套用；若無，比對 `typeDB` 側錄呼叫次數，高於信賴閾值（`confidenceThreshold`）時生成對應的 `*Shape` Interface 並寫入全域暫存表。
3. 呼叫 `resolveAndSetReturnType` 推導函式回傳值型別。

### 階段 6：型別雙向傳播
1. **正向型別傳播**：遍歷函式內所有變數宣告（`VariableDeclaration`），透過初始化表達式的靜態推導型別，自動標記局部變數（例如 `var staff: AbcJS4.Staff`）。
2. **反向型別傳播**：遍歷 `this.methodName(args)`，取得引數的靜態型別，反向註冊至目標方法的參數上。

### 階段 7：型別寬化與 Interface 寫入
1. 所有推導與側錄型別執行 `widenTypeName`，排除字面量型別收窄。
2. 檔案寫入前，將此檔案推導出的所有 `*Shape` Interface 宣告字串，統一插入至檔案的 Import 語句下方，完成代碼物理落盤。

---

## 3. 關鍵推導演算法與邏輯剖析

### A. 型別寬化演算法 (`widenTypeName`)

為了防止 TypeScript 發生過度收窄（Over-narrowing），例如將 `let isPlay = false` 推導為 `isPlay: false`，必須執行型別寬化：

```typescript
function widenTypeName(t: string): string {
  // 1. 遞迴拆解與處理聯集型別 (Union Types)
  if (t.includes(' | ')) {
    const parts = t.split(' | ').map(p => widenTypeName(p));
    return Array.from(new Set(parts)).join(' | '); // 去除重複型別
  }
  
  const clean = t.trim();
  
  // 2. 布林字面量寬化
  if (clean === 'true' || clean === 'false') {
    return 'boolean';
  }
  
  if (!clean) return t;
  
  // 3. 數值字面量寬化 (過濾 NaN)
  if (!isNaN(Number(clean))) {
    return 'number';
  }
  
  // 4. 字串字面量寬化 (比對單/雙引號與模板字面量)
  if ((clean.startsWith('"') && clean.endsWith('"')) || 
      (clean.startsWith("'") && clean.endsWith("'")) || 
      (clean.startsWith("`") && clean.endsWith("`"))) {
    return 'string';
  }
  
  return t;
}
```

### B. 回傳值推導優先級演算法 (`resolveAndSetReturnType`)

函式回傳值的推導是結合靜態與動態的最佳體現：

```
┌────────────────────────────────────────────────────────┐
│                 1. 呼叫 getReturnType()                 │
│                 藉由 AST 取得靜態推導型別                  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │  是否為有效型別 (非 any / null / 空)? │
        └───────────┬──────────────────┬───────┘
                    │ 是                │ 否 (或為 '{}')
                    ▼                  ▼
      ┌───────────────────────┐  ┌───────────────────────────────────┐
      │  2. 套用該型別並退出    │  │  3. 掃描 AST 中 Return 陳述式字面量  │
      └───────────────────────┘  └─────────────────┬─────────────────┘
                                                   │
                                                   ▼
                               ┌─────────────────────────────────────┐
                               │  是否包含明確的 Return表達式型別?    │
                               └───────────┬──────────────────┬──────┘
                                           │ 是                │ 否
                                           ▼                  ▼
                             ┌───────────────────────┐  ┌────────────────────┐
                             │  4. 合併 Return 型別   │  │ 5.Fallback 查詢    │
                             │  並標註為聯集型別後退出  │  │   typeDB 動態側錄   │
                             └───────────────────────┘  └──────────┬─────────┘
                                                                   │ (大於信賴閾值)
                                                                   ▼
                                                         ┌───────────────────┐
                                                         │ 6. 標註側錄 Shape  │
                                                         └───────────────────┘
```

---

## 4. 併發安全與 AST 節點失效機制 (Invalidated Nodes)

在撰寫 AST 轉換工具（Codemod）時，最容易遇到的崩潰是 **`AST Node Invalidated`**。

### 原因解析
`ts-morph` 底層封裝了 TypeScript 語法樹。當我們調用如 `stmt.remove()` 或 `sourceFile.insertText()` 等破壞性修改方法時，整個語法樹的字串偏移量（Offset）與節點索引會被重新計算。若在此時，我們還在一個 `forEach` 迴圈中持有舊的節點引用並嘗試對其進行修改，TypeScript 系統將會因為找不對正確的語法座標而直接拋出錯誤並崩潰。

### `js2ts-infer` 的安全實作方案
在 `processFileRefactoring` 中，類別屬性的宣告與提升重構採取了**雙階段（Read-Collect-Modify Separate）設計**：

1. **第一階段：唯讀收集**
   - 程式碼遍歷建構子語句，將符合重構條件的屬性儲存在一個記憶體陣列（`propertiesToMigrate`）中，此時**完全不操作語法樹的寫入與刪除**。
2. **第二階段：倒序修改**
   - 在屬性收集完畢後，呼叫 `cls.insertProperties(0, propertiesStructures)` 一次性將所有屬性插入類別頂端。
   - 在移除建構子中的原賦值語句時，採用**逆序（倒序）遞減迴圈**：
     ```typescript
     const currentStatements = ctor.getStatements();
     for (let i = currentStatements.length - 1; i >= 0; i--) {
       // 從最後一個陳述式開始檢查並 remove()
     }
     ```
   - **原理**：倒序移除可以確保被移除的節點永遠位於語法樹的最下端，其前方的所有節點在 AST 中的字元偏移量（Char Offset）完全不會改變，從而徹底消除了節點坐標偏移導致的 AST 失效崩潰。

---

## 5. 邊界漏洞 (Edge Cases) 深度剖析與解決方案

目前系統架構在處理複雜的超大型專案時，存在以下三個潛在的邊界漏洞：

### A. 聯集與跨檔案 Interface 重複聲明 (Interface Duplication)
- **問題**：在不同檔案中，如果多個 Class 都包含名稱相同的參數且側錄到相同的 Shape，會各自在檔案頂部產生同名的 `*Shape`（如 `VoiceShape`）。這在全域編譯時會引發 `Duplicate identifier` 衝突。
- **專家級解決方案**：
  在 `code-generator` 中引入全域的 Interface 命名空間與雜湊防撞器：
  ```typescript
  import { createHash } from 'crypto';
  
  function getUniqueShapeName(baseName: string, shape: any): string {
    const shapeStr = JSON.stringify(shape);
    const hash = createHash('md5').update(shapeStr).digest('hex').slice(0, 6);
    return `${baseName}_${hash}Shape`;
  }
  ```

### B. 類別繼承鏈（Class Inheritance Chain）中的型別傳播盲區
- **問題**：若子類（Child Class）繼承了父類（Parent Class）的某些方法，子類實例在調用該繼承方法時，AST 的正向與反向傳播在 `cls.getDescendantsOfKind(SyntaxKind.CallExpression)` 中僅能找到自身類別內的定義，無法溯源到父類別，這會導致繼承方法的參數與回傳值被誤標記為 `any`。
- **專家級解決方案**：
  在重構類別方法前，應遞迴取得其父類別（基底類別）的 AST 定義，進行方法符號（Symbol）對齊：
  ```typescript
  function getParentClassMethods(cls: ClassDeclaration): Map<string, MethodDeclaration> {
    const methods = new Map<string, MethodDeclaration>();
    let baseClass = cls.getBaseClass();
    while (baseClass) {
      baseClass.getMethods().forEach(m => {
        if (!methods.has(m.getName())) {
          methods.set(m.getName(), m);
        }
      });
      baseClass = baseClass.getBaseClass();
    }
    return methods;
  }
  ```

### C. 檔案轉換的 Git 原子性防護不足
- **問題**：若程式執行到一半中途崩潰（比如 Out of Memory 或手動中斷），部分 JS 檔案已被 `fs.unlinkSync` 刪除，而 TS 檔案尚未寫入，這會造成工作目錄的程式碼毀損。
- **專家級解決方案**：
  實作暫存區雙緩衝機制。所有轉譯後的 TS 代碼先寫入 `.temp_ts` 暫存目錄。當**所有檔案皆無錯轉換完畢後**，才一次性進行舊 JS 檔案刪除與新 TS 檔案移入的原子性（Atomic）寫入操作，確保重構流程的安全性。
