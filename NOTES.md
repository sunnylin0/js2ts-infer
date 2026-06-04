# 目前工作進度與摘要 (NOTES.md)

## 1. 目前進度 (最後處理到哪裡)
- **Class 建構函式型別注入 (v1.1.4)**：修復了 `js2ts-infer` 工具在生成型別時遺漏遍歷 `cls.getConstructors()` 的問題。現已能自動將 `types-observed.json` 中側錄到的建構函式參數型別（如 `particles.ts` 中的 `x: number, y: number, color: string`）精確寫入生成的 TypeScript 檔案中。
- **無依賴屬性置頂初始化與 JSDoc 升級 (v1.1.3)**：自動將 `constructor` 內不依賴參數的 `this.xxx = yyy` 語句及其註解（自動升級為 JSDoc）搬移至 Class 頂部作為屬性初始值，使 Class 成員結構更現代化，並從 `constructor` 中安全移除。
- **端到端驗證**：已在 `3_Snake` 專案上成功執行 `js2ts-infer generate --force` 重構。驗證結果顯示 `Particle` 與 `Snake` 的 `constructor` 及置頂屬性均符合預期地被注入。
- **歷史軌跡記錄**：所有修改大綱與歷史進度已詳實記錄於 [Releases.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/Releases.md) 及 `hlog/` 的歷史存檔中。

## 2. 當前重點 (核心內容)
- **非同步函數呼叫關係鏈 (Call Graph) 收集與視覺化**：
  - **核心需求**：在動態側錄期間，記錄「File-Function 呼叫 File-Function」的關聯及次數，並整合至 `types-observed.json` 中。
  - **細節決策**：
    1. **粒度**：檔案級依賴與函數級依賴雙重支援（在 UI 中可勾選切換）。
    2. **非同步追蹤**：藉由 runtime wrapper 中的閉包儲存 `parentCaller`，在 callback 執行時暫時壓入 `callStack`，以串聯非同步/間接呼叫鏈。
    3. **範圍**：僅限專案內部模組，排除 `node_modules` 與 Web/Built-in API。
    4. **靜態補足**：透過靜態 AST 分析，抓取 `import`/`require` 的引用，將「未執行到的潛在呼叫關係」以虛線呈現在圖表上。
    5. **SVG 工具流程圖**：建立內建檢視指令 `js2ts-infer visual`，在本地啟動一個載入 D3.js 的 `visualizer.html` 網頁。該圖表為力導向圖，支援節點拖曳手動固定位置、切換檔案/函數模式、搜尋、與 SVG 圖檔匯出。

## 3. 待處理事項 (接下來要做什麼)
- **[ ] 實作 Call Graph 收集與視覺化**：
  1. 修改 `babel-plugin-js2ts.ts`：在 Function 入口插入 `enterFunc` 插樁。
  2. 升級 `tracker-client.ts`：新增全域 `callStack` 陣列，實作 `enterFunc` 與 `exitFunc`，並在包裝 callback 時綁定 `parentCaller`。
  3. 修改 `static-analyzer.ts`：掃描 `import`/`require` 與 `CallExpression` 以偵測潛在呼叫關係。
  4. 升級 `tracker-server.ts` 與合併邏輯：在 `types-observed.json` 中整合並加載 `"__callGraph"` 資料。
  5. 實作 `visualizer.html / visualizer.ts`：以 D3.js 繪製可拖曳固定、切換模式、可匯出之 SVG 架構圖。
- **[ ] 修正 `3_Snake` 專案的 `index.html` 引用**：將 `index.html` 的引入修改為 `/src/main.ts`，以便 Vite 能正確編譯 TS。
- **[ ] 執行其餘專案轉換與 Review**：對剩餘專案執行重構，並使用 `js2ts-infer review` 審查 `any` 型別。

## 4. 核心設定 (需要保持的風格與規範)
- **依賴管理**：JS/TS 專案管理一律使用 `pnpm` 工具。
- **語系要求**：所有對話、回覆、說明文件、`Releases.md`、`task.md` 及 `implementation_plan.md` 均須使用 **繁體中文**。
- **代碼品質**：轉換生成的 TypeScript 程式碼不可有任何 TypeScript 編譯錯誤（無 syntax / semantic error），且需符合使用者的 Prettier 格式偏好。
- **記錄規範**：每次對話有任何代碼變更或重構大綱，都必須同步更新至根目錄的 [Releases.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/Releases.md)。
