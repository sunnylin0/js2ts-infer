# Releases 大綱 (History)

## [2026-06-04] v1.3.0 - 實作非同步函數呼叫關係鏈 (Call Graph) 收集與互動式視覺化
- **進入/離開與異常容錯插樁**：於所有函數頂端/尾端插樁 `enter` / `exit` 追蹤，並使用 `try-finally` 結構確保例外拋出時呼叫棧亦能正確splice清理。
- **非同步與 Callback 關係鏈捕捉**：升級 `tracker-client` 維護全域 `callStack`，並在 callback 建立時利用閉包儲存 `parentCaller`，於執行時暫時壓棧，成功解決跨事件迴圈與非同步回呼的呼叫鏈追蹤難題。
- **靜態 AST 依賴掃描**：於 `scan` 階段解析 `Import` / `require` 與 `CallExpression`（包含 namespace/CJS命名空間/`this.` 本地方法），產出 `boundary-map.json` 靜態依賴圖。
- **D3.js 互動式視覺化檢視工具**：實作 `visualize` 指令啟動 Web 伺服器，Serve 搭載 D3.js v7 的架構圖網頁。採用暗黑 glassmorphism 設計與 neon glow 霓虹發光美學，提供檔案/函數層級切換、動態霓虹實線、靜態虛線、Slider 篩選、高亮搜尋、拖曳固定、佈局儲存至 `visualizer-layout.json`、一鍵匯出 SVG 功能。

---

## [2026-06-04] v1.4.0 - 支援類別級 (Class-level) Call Graph 關係鏈收集與視覺化

- **雙階段靜態類別依賴掃描**：於 `static-analyzer.ts` 內設計雙階段 AST 分析，先記錄全域類別映射，第二階段再掃描建構函式與方法呼叫以精確輸出 `staticCallGraph.classes`（例如 `PlayingState -> Snake`）。
- **執行期類別前綴插樁**：修改 `babel-plugin-js2ts.ts` 與 `tracker-client.ts`，在執行期型別收集與呼叫鏈上自動為類別方法與建構子附加 `ClassName.` 前綴（例如 `ParticleSystem.spawn`），藉此在跨類別時精確區分同名方法。
- **介面名稱清洗與 TS 相容**：更新 `code-generator.ts` 中 Class Method 的型別注入規格，並自動清除所產生參數 interface 名稱中的點號，避免點號引起 TypeScript 語法錯誤（例如將 `Particle.constructor` 清洗為 `ParticleconstructorSvgShape`）。
- **「類別級」視覺化架構圖**：於 `templates/visualizer.html` 新增「類別級 (Class-level)」檢視選項。前端將側錄資料中含有點號的追蹤 ID 予以切割聚合至各自 of Class 節點，成功繪製出類別與類別間的動靜態呼叫關係。

