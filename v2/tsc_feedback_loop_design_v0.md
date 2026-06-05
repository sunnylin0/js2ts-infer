# TypeScript 編譯錯誤反饋循環與 AI 自我修正設計方案

本文件詳細規劃了將 **TypeScript Compiler (TSC) 診斷結果** 與 **AI (LLM) 修正代理** 整合至型別重構管線（Pipeline）的第五步架構。

---


## 1. 最佳型別注入架構與順序

型別注入順序：**1. 參照宣告檔 $\rightarrow$ 2. 靜態分析 & JSDoc $\rightarrow$ 3. AST 正反向傳播 $\rightarrow$ 4. 動態側錄兜底**

### 1.1 第一步：讀取既有宣告檔（參照 `*.d.ts`）建立型別地圖
*   **理由**：`*.d.ts` 是人工或舊工具定義的精確基準，準確率為最高優先級。
*   **實作方式**：在 CLI 重構啟動時，使用 `ts-morph` 或 `typescript` compiler API 載入所有 `*.d.ts`，建立一個以「類別/介面名稱」與「成員/屬性名稱」為 Key 的全域型別字典，作為後續型別對齊與傳播的基準。

### 1.2 第二步：JSDoc 提取與靜態初步推導
*   **理由**：許多 JS 遺留專案內含 JSDoc 註解，這是無侵入式的精確靜態型別來源。
*   **實作方式**：
    *   **JSDoc 解析**：偵測並提取 `/** @param {AbcJS4.Lines} lines */` 等註解型別直接標註至參數。
    *   **初始值推導**：分析 AST 中的 `VariableDeclaration` 初始化表達式。若為 `const x = 123` 推導為 `number`；若為 `this.lines = []` 則與第一步的型別字典對齊。

### 1.3 第三步：AST 型別正反向傳播 (Type Propagation)
*   **理由**：利用 compiler API 的型別關係鏈，將已知的 `*.d.ts` 或靜態推導型別擴散到其他地方，避免產生大量 `any`。
*   **實作方式**：
    *   **正向傳播**：如局部變數 `var x = this.lines[i]`，因 `lines` 型別為 `Lines[]`，可自動推導並標記 `x: Lines`。
    *   **反向傳播**：若方法 `foo(x)` 被以 `this.foo(this.lines)` 呼叫，反向推導並標記被呼叫之 `foo` 的參數 `x` 型別為 `Lines[]`。

### 1.4 第四步：動態側錄資料覆寫與兜底 (`js2ts-infer` 側錄資料)
*   **理由**：動態側錄有代碼覆蓋率限制（沒跑到的分支無資料），但針對靜態分析無法處理的動態邊界（如 API payload、多變量 callback 參數），動態側錄是最好的補丁。
*   **實作方式**：只在目標變數在前三步推導後仍為 `any` 或無推導型別時，才去查詢 `observed-types.json` 進行覆寫，避免污染已推導出的精確型別。

### 1.5 第五步：TSC 編譯錯誤反饋循環與 AI 自我修正
*   **理由**：不論靜態分析或動態側錄，都難以完全預期 TypeScript 編譯器的嚴格型別檢查規則（如潛在的 `null/undefined` 指派、選用屬性遺漏等）。將最終產出的代碼交由真實編譯器 (tsc) 診斷，並藉由 AI 的語意重構能力針對編譯錯誤精準微調，是確保轉換後專案 100% 可順利打包的終極防線。
*   **實作方式**：在代碼產出後，背景執行 TypeScript Compiler API，過濾出核心型別錯誤（如 `TS2322`, `TS2339` 等）。對每個出錯點擷取上下 15 行上下文程式碼與診斷訊息，呼叫 AI 生成修復型別的補丁 (JSON Patch)，隨後使用 `ts-morph` 自動套用，循環迭代直到編譯無錯誤或達到收斂上限。

---

## 2. 完整五階段重構管線流程

型別重構以「靜態基準地圖」與「AST 傳播」建構地基，以「動態側錄」填補動態行為，最後利用「TSC 診斷與 AI 反饋循環」進行精準微調。

```mermaid
graph TD
    A[JS 原始碼] --> B[1. 載入 *.d.ts 宣告檔]
    B --> C[2. 靜態分析 & JSDoc 提取]
    C --> D[3. AST 正反向型別傳播]
    D --> E[4. js2ts-infer 動態側錄兜底]
    E --> F[產出初版 *.ts]
    F --> G[5. TSC 編譯診斷]
    G -- 偵測到型別錯誤 --> H[提取錯誤上下文 & 產生 Prompt]
    H --> I[AI 修正模組 (LLM)]
    I --> J[套用 AST 程式碼補丁]
    J --> G
    G -- 編譯無錯誤 / 達到最大嘗試次數 --> K[輸出強型別 *.ts]
```

---

## 3. 第五步：TSC 反饋與 AI 修正細節設計

### 3.1 TSC 診斷結果抓取與結構化 (Diagnostics Parsing)

我們不透過外掛子進程執行 `tsc` CLI，而是直接在 Node.js 中調用 `typescript` Compiler API，這能提供毫秒級的解析速度，並直接獲得語法樹節點的 AST 座標。

```typescript
import * as ts from 'typescript';

interface TypeCheckError {
  filePath: string;
  line: number;
  character: number;
  code: number;
  messageText: string;
  errorSnippet: string;
  sourceText: string;
}

function runTscDiagnostics(filePaths: string[], compilerOptions: ts.CompilerOptions): TypeCheckError[] {
  const program = ts.createProgram(filePaths, compilerOptions);
  const diagnostics = program.getSemanticDiagnostics();
  
  return diagnostics.map(diag => {
    const file = diag.file!;
    const { line, character } = file.getLineAndCharacterOfPosition(diag.start!);
    const sourceText = file.getText();
    const errorSnippet = sourceText.substring(diag.start!, diag.start! + diag.length!);
    
    return {
      filePath: file.fileName,
      line: line + 1, // 轉為 1-indexed
      character: character + 1,
      code: diag.code,
      messageText: ts.flattenDiagnosticMessageText(diag.messageText, "\n"),
      errorSnippet,
      sourceText
    };
  });
}
```

### 2.2 錯誤過濾與關注點分類
並非所有 TSC 錯誤都交給 AI 處理。我們僅篩選與**型別安全性、成員缺失、指派失敗**相關的錯誤代碼：
*   **TS2322**: `Type 'X' is not assignable to type 'Y'`（型別指派不相容，通常需修正為 Union）。
*   **TS2339**: `Property 'X' does not exist on type 'Y'`（介面缺少成員，或 Y 應該是更寬鬆的型別）。
*   **TS2345**: `Argument of type 'X' is not assignable to parameter of type 'Y'`（函式呼叫參數不對齊）。
*   **TS2531 / TS2532**: `Object is possibly 'null' or 'undefined'`（缺少可空性處理，需加上可選鏈 `?.` 或 Union `| null`）。

---

## 3. AI 修正模組 (LLM Agent) 整合設計

### 3.1 提取錯誤上下文 (Error Context Window)
為了防止 LLM 因上下文過大產生幻覺，我們不將整份檔案送出，而是提取以錯誤行（`ErrorLine`）為中心的前後特定範圍代碼。

*   **滑動窗口 (Window Size)**：向上取 15 行，向下取 15 行，並附加該檔案中定義的 Class 簽章。
*   **型別參考字典**：隨附專案載入的 `*.d.ts` 當中該型別的定義摘要。

### 3.2 Prompt 工程設計 (System & User Prompts)

#### System Prompt
> [!IMPORTANT]
> 限制 LLM 必須扮演精確的 AST 重構代理，禁止產生任何 markdown 格式以外的閒聊文字，且只針對指定的變數/行數進行精準的型別補丁 (Type Patch)。

```markdown
你是一個專門修復 TypeScript 編譯錯誤的 AST 重構代理。
你的任務是讀取一段含有 TSC 編譯錯誤的程式碼與錯誤訊息，並給出修復後的型別宣告。

## 規則：
1. 僅修改型別宣告，不要更改原本 JS 的執行邏輯。
2. 優先考慮將型別改為 union 型別 (例如 X | null) 或加上可選屬性 (X?)，而不是直接改為 any。
3. 如果該型別是來自外部介面，請提供該變數應有的正確型別或加上類型斷言 (Type Assertion, as X)。
4. 請回傳一個 JSON 格式的 Patch，包含要替換的目標程式碼 (targetCode) 與替換後的程式碼 (patchedCode)。
```

#### User Prompt 範例
```json
{
  "errorMessage": "TS2322: Type 'null' is not assignable to type 'AbcJS4.Lines'.",
  "errorLocation": "abc_tune.ts 行 123",
  "contextCode": "
    108:   getElementFromChar(char): Voice {
    109:       for (var i = 0; i < this.lines.length; i++) {
    110:           var line :AbcJS4.Lines = this.lines[i]; // 這裡可能為 null
    111:           // ...
    123:           line = this.findLine(char); // TSC 報錯此行
    124:       }
    125:   }
  ",
  "typeDictionary": {
    "AbcJS4.Lines": "interface Lines { staff: Staff[]; ... }"
  }
}
```

#### LLM 回傳 JSON 規格
```json
{
  "targetCode": "var line :AbcJS4.Lines = this.lines[i];",
  "patchedCode": "var line :AbcJS4.Lines | null = this.lines[i];"
}
```

---

## 4. 程式碼修正應用與循環控制

### 4.1 套用補丁 (Patch Application)
當 AI 回傳 Patch 後，重構程式會比對 `targetCode` 在檔案中的精確 AST 範圍，使用 `ts-morph` 進行節點取代：

```typescript
import { Project } from 'ts-morph';

function applyPatch(filePath: string, target: string, patch: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(filePath);
  const fileText = sourceFile.getText();
  
  if (fileText.includes(target)) {
    const updatedText = fileText.replace(target, patch);
    sourceFile.replaceWithText(updatedText);
    sourceFile.saveSync();
  }
}
```

### 4.2 循環收斂與終止條件 (Convergence Control)
為防止 AI 與編譯器陷入死循環（例如 A 錯誤修復引發 B 錯誤，B 錯誤修復又引發 A 錯誤），我們設定以下控制參數：
*   **Max Iterations**：單一檔案最大反饋次數限制為 **5 次**。
*   **錯誤數監控**：若某次迭代後，編譯錯誤的數量**沒有下降且錯誤類型完全相同**，則立即終止該檔案的循環。
*   **防禦性退回**：若嘗試 3 次後仍無法消除錯誤，自動將該節點的型別退回最安全的 `any`，並記錄至警告日誌。
