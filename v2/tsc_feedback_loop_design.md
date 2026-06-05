# TypeScript 重構（generate 階段）型別注入與 TSC/AI 自我修正設計方案

本文件詳細規劃了 `js2ts-infer` 工具中 **`generate` 階段** 的完整型別注入管線（Pipeline）。此階段的核心目標是將原始 JavaScript 代碼轉換為強型別的 TypeScript 代碼，並藉由 TypeScript Compiler (TSC) 診斷與 AI 修正模組，確保最終產出的代碼可 100% 編譯通過。

---

## 1. 整體執行架構

重構管線（`cli.js generate`）在執行時，會遵循「以靜態宣告為基礎、經由 AST 傳播擴散、再以動態側錄兜底，最終透過編譯診斷與 AI 自我修正收斂」的架構。

```mermaid
graph TD
    A[JS 原始碼] --> B[1. 載入 *.d.ts 建立型別字典]
    B --> C[2. 靜態分析 & JSDoc 提取]
    C --> D[3. AST 正反向型別傳播]
    D --> E[4. 動態側錄兜底 observed-types]
    E --> F[記憶體中產出初版 *.ts AST]
    F --> G[5. TSC 編譯診斷]
    G -- 偵測到核心型別錯誤 --> H[提取錯誤上下文 & 產生 Prompt]
    H --> I[AI 修正模組 (LLM Agent)]
    I --> J[套用 AST 程式碼補丁]
    J --> G
    G -- 編譯無錯誤 / 達到最大嘗試次數 --> K[輸出強型別 *.ts 檔案]
```

---

## 2. 五階段型別注入細節

### 2.1 第一步：載入 `*.d.ts` 宣告檔並建立全域型別字典
*   **目的**：載入專案中既有的 `*.d.ts` 宣告檔（如人工編寫或舊工具產出的型別定義），以此作為最高優先級的型別基準，防止遺漏既有的精確型別定義。
*   **實作細節**：
    *   在 `runGeneration` 啟動時，使用 `globSync` 搜尋輸入目錄下的所有 `*.d.ts`（例如 `type/index.d.ts`）。
    *   利用 `ts-morph` 的 `project.addSourceFileAtPath` 將宣告檔載入。
    *   在記憶體中建立一個**全域型別字典 (In-Memory Type Map)**。其結構為：
        ```typescript
        type TypeMap = Map<ClassName, Map<PropOrMethodName, {
          typeStr: string;       // 屬性或方法傳回值的型別字串
          params?: { name: string; typeStr: string }[]; // 方法的參數型別列表
        }>>;
        ```
    *   後續的 Class 屬性對齊、方法參數與傳回值對齊，都會優先以此字典進行查表覆寫。

### 2.2 第二步：JSDoc 提取與靜態初步推導
*   **目的**：利用 JavaScript 中現存的註解與簡單的賦值表達式，快速對齊初始型別。
*   **實作細節**：
    *   **JSDoc 解析**：使用 `ts-morph` API 解析函數與類別方法之 JSDoc 標籤。如偵測到 `@param {AbcJS4.Lines} lines`，則直接為該參數標註型別。
    *   **值類型推導**：分析變數宣告（`VariableDeclaration`）或類別屬性的初始化值（`initializer`）。若為 Literal 值（如 `true`、`123`、`"abc"`），直接推導為 `boolean`、`number`、`string`。若初始化為物件或陣列，則結合第一步的字典進行對齊。

### 2.3 第三步：AST 型別正反向傳播 (Type Propagation)
*   **目的**：利用 Compiler API 的型別關係鏈，將已知的精確型別在 AST 中擴散，避免留下大量的 `any`。
*   **實作細節**：
    *   **Class Field 屬性提升**：
        1. 掃描 Class 內部所有 `this.xxx` 賦值，自動在 Class 頂部補上未宣告的屬性。
        2. 針對 `constructor` 內無外部依賴的成員賦值（如 `this.play = false`），將其提升（Migrate）至 Class 頂部做為屬性初始值，並將對應的註解轉換為 JSDoc 注入。
        3. 型別標註時，自動將 interface 點號清洗（例如 `Particle.constructor` 轉換為 `ParticleconstructorSvgShape`），防止 TS 語法錯誤。
    *   **區域變數正向傳播**：遍歷方法內的 `VariableDeclaration`，若其未標明型別，則透過 `decl.getInitializer()?.getType()` 取得推導型別（例如由 `var line = this.lines[i]` 得到 `line: AbcJS4.Lines`），並將型別標註於該變數。
    *   **參數反向傳播**：遍歷 Class 中的 `CallExpression`（以 `this.method(...)` 調用之處），分析傳入的引數型別（Argument Type），並反向寫入被呼叫方法的對應參數上（例如調用 `this.computePickup(this.lines)`，反推 `computePickup` 的第一參數型別為 `Lines[]`）。
    *   **方法傳回值正向標註**：透過 `method.getReturnType()` 推導並自動標註方法的傳回值型別（例如 `getElementFromChar(char): Voice | null`）。
    *   **型別清洗與命名空間保留**：在提取型別文字時，透過自定義的 `getCleanTypeText` 過濾 inline object 與複雜的 import 雜訊，但保留 `AbcJS4.` 等命名空間前綴，確保在非 namespace 檔案中能全域識別型別。

### 2.4 第四步：動態側錄資料覆寫與兜底 (`js2ts-infer` 側錄資料)
*   **目的**：利用程式執行期間收集的動態型別，作為前述靜態分析無法覆蓋之邊界（如 callback 參數、動態 payload）的兜底型別。
*   **實作細節**：
    *   載入 `types-observed.json`。
    *   只有當目標變數在前三步推導後**仍為 `any` 或未被標記型別**時，才查詢對應的 `trackerId`（格式為 `filePath::fnName::param::paramName` 或 `::return`）。
    *   若動態資料中 `observedTypes` 含有多個型別，則將其組合成 Union 型別（如 `string | number`）。
    *   若 `objectShapes` 含有物件結構，則透過 `mergeObjectShapesArray` 進行合併，並動態在原始碼中產生對應的 `interface XXXShape { ... }` 進行標註。

### 2.5 第五步：TSC 編譯錯誤反饋循環與 AI 自我修正 (Feedback Loop)
*   **目的**：做為重構管線的最後一道防禦。TypeScript 的編譯檢查（如 `strictNullChecks`、選用屬性）十分嚴格，透過真實的 `tsc` 診斷並調用 AI 對出錯點進行語意重構，能保證產出的代碼可編譯通過。
*   **實作細節**：
    *   **TSC 診斷擷取 (Diagnostics Parsing)**：
        在產生初版 `.ts` 後，不啟動子進程執行 `tsc`，而是直接調用 Node.js 的 `typescript` Compiler API。
        ```typescript
        const program = ts.createProgram(filePaths, compilerOptions);
        const diagnostics = program.getSemanticDiagnostics();
        ```
        這能提供毫秒級的速度並精確獲取錯誤在 AST 中的字元座標（`diag.start`）。
    *   **關注點過濾**：
        只針對影響編譯的型別核心錯誤代碼進行修復：
        *   `TS2322`（型別不相容）
        *   `TS2339`（屬性不存在）
        *   `TS2345`（參數型別不對齊）
        *   `TS2531 / TS2532`（物件可能為 null 或 undefined）
    *   **上下文提取滑動窗口 (Context Window)**：
        對每個出錯的位置，擷取錯誤行上下 **15 行**的原始碼，同時查閱型別字典，提供相關型別在 `*.d.ts` 中的定義摘要作為 LLM 提示。
    *   **AI 修正模組 (LLM Agent)**：
        將錯誤訊息、上下文程式碼與型別參考字典打包送給 LLM。System Prompt 限制 LLM 必須為純 AST 重構代理，禁止閒聊，且只回傳以下 JSON Patch 格式：
        ```json
        {
          "targetCode": "var line :AbcJS4.Lines = this.lines[i];",
          "patchedCode": "var line :AbcJS4.Lines | null = this.lines[i];"
        }
        ```
    *   **AST 補丁套用 (Patch Application)**：
        利用 `ts-morph` 對出錯的 `SourceFile` 進行字串或 AST 節點替換並存檔。
    *   **收斂控制 (Convergence Control)**：
        *   **單一檔案最大嘗試次數**：最大迭代次數限制為 **5 次**。
        *   **錯誤監控**：若迭代後錯誤數量未下降且錯誤類型完全相同，立即中斷該檔案的循環。
        *   **安全退回 (Fallback)**：若嘗試 3 次後仍無法消除錯誤，自動將出錯點的型別退回最安全的 `any`，寫入警告日誌，確保程式可順利打包。

---

## 3. 重構管線輸出與驗證

在完成第五步的自我修正後，工具會執行最後的產出與驗證：
1. **正式寫入**：移除暫存的原始 JS 檔案，寫入最終修正後的 `.ts`。
2. **打包驗證**：若有配置，則在目標目錄執行 `pnpm run build` 或 `tsc --noEmit`，確認專案完全無型別錯誤。
