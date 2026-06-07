# 頂級提示詞：js2ts-infer 重構核心優化指南 (Whole-Project Context & Memory Transaction)

## 📌 給 AI 的角色設定 (System Role)
你是一位精通 TypeScript 編譯器 API、`ts-morph` 與 Codemod 重構的高階軟體架構師。你對 AST 節點生命週期、Compiler TypeChecker 的內部快取與編譯效能優化有著深刻的研究。

---

## 🎯 任務目標 (The Mission)
重構 `js2ts-infer` 專案中負責程式碼轉譯與型別注入的兩大核心檔案：
1. **`src/code-generator.ts`**：優化重構管線（Pipeline）控制層，改為「全專案語境（Whole-Project Context）載入」與「記憶體原子交易落盤（Transactional Commit）」。
2. **`src/ast-refactorer.ts`**：修改 API 接收參數，使其能在全專案記憶體語境中運行，並重構內部繁瑣的節點搜尋邏輯，整合 `ts-query` 選擇器。

---

## 🛠 核心優化指標與底層技術規格 (Technical Specifications)

請嚴格遵循以下重構架構規範進行代碼調整：

### 1. 全專案語境載入 (Whole-Project Context)
- **現狀漏洞**：目前採用「單檔隔離重構」，每處理完一個檔案就呼叫 `removeSourceFile()`。這導致 `TypeChecker` 無法進行跨檔案型別解析，跨模組調用全被標記為 `any`。
- **重構要求**：
  - 在 `code-generator.ts` 啟動時，先使用 `globSync` 搜尋並加載所有 `*.d.ts` 檔案與所有待轉換的 `.js` 檔案。
  - 將 `.js` 檔案在記憶體中建立為虛擬的 `.ts` 檔案（例如 `project.createSourceFile(tsVirtualPath, originalJsCode)`）。
  - 所有檔案加載完成後，**維持其在 Project 記憶體樹中**，確保 `TypeChecker` 擁有全專案的完整依賴圖。

### 2. 單一全域 TypeChecker (Performance Caching)
- **現狀漏洞**：在迴圈中不斷新增與移除檔案會使 TS Compiler 緩存失效，反覆建立 `TypeChecker` 導致 CPU 嚴重空轉。
- **重構要求**：
  - 在進入重構迴圈前，僅呼叫一次 `const typeChecker = project.getTypeChecker()`。
  - 將 `typeChecker` 作為參數傳遞給 `processFileRefactoring`、`annotateFunction` 與 `resolveAndSetReturnType`。
  - 確保整個 `generate` 執行期間，共享同一個 `TypeChecker` 實例，發揮編譯器快取最大效能。

### 3. 記憶體原子交易落盤 (Memory-based Transaction Commit)
- **現狀漏洞**：一邊重構一邊呼叫 `fs.unlinkSync` 與 `fs.writeFileSync`，一旦程序異常崩潰，專案目錄會處於「半 JS 半 TS」損毀狀態。
- **重構要求**：
  - 在重構過程中，**完全禁止**對磁碟進行 `fs.unlinkSync` 或 `fs.writeFileSync` 操作。
  - 所有的 CJS 轉 ESM、屬性提升、參數標註、型別傳播等，皆在 `ts-morph` 虛擬節點上進行記憶體修改。
  - 重構完成後，若是 `--dry-run` 模式，直接比對記憶體與磁碟的原檔產出 Diff。
  - 若是寫入模式，一次性調用 `project.save()` 或透過安全的輸出串流寫入目標目錄，並批次移除舊 JS 檔案，確保原子性操作（All or Nothing）。

### 4. 整合 `ts-query` 選擇器 (Clean Selector-based AST Queries)
- **重構要求**：
  - 在 `ast-refactorer.ts` 內，引入 `@phenomnomnominal/tsquery`。
  - 將複雜的 AST 節點過濾程式碼替換為直覺的 CSS 選擇器，例如：
    - 尋找 `this.prop = val`：`BinaryExpression[operatorToken.kind=63]:has(PropertyAccessExpression[expression.name="this"])`
    - 尋找內嵌的 `require` 語句：`CallExpression[expression.name="require"]`
  - 使用 `sourceFile.getNodeFromCompilerNode(tsNode)` 將查詢到的原生 compiler 節點無縫包裝回 `ts-morph` 強型別節點進行後續的修改。

---

## 📋 預期輸出產物與實作格式 (Expected Code Structure)

請為我輸出以下內容：
1. **優化後的 `src/code-generator.ts` 原始碼**。
2. **優化後的 `src/ast-refactorer.ts` 原始碼與關鍵修改點說明**。
3. **優化後的架構如何解決 AST 節點失效與效能瓶頸的底層分析**。
