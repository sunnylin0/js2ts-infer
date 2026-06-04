# Releases 大綱 (History)

## [2026-06-04] v1.3.0 - 實作非同步函數呼叫關係鏈 (Call Graph) 收集與互動式視覺化
- **進入/離開與異常容錯插樁**：於所有函數頂端/尾端插樁 `enter` / `exit` 追蹤，並使用 `try-finally` 結構確保例外拋出時呼叫棧亦能正確splice清理。
- **非同步與 Callback 關係鏈捕捉**：升級 `tracker-client` 維護全域 `callStack`，並在 callback 建立時利用閉包儲存 `parentCaller`，於執行時暫時壓棧，成功解決跨事件迴圈與非同步回呼的呼叫鏈追蹤難題。
- **靜態 AST 依賴掃描**：於 `scan` 階段解析 `Import` / `require` 與 `CallExpression`（包含 namespace/CJS命名空間/`this.` 本地方法），產出 `boundary-map.json` 靜態依賴圖。
- **D3.js 互動式視覺化檢視工具**：實作 `visualize` 指令啟動 Web 伺服器，Serve 搭載 D3.js v7 的架構圖網頁。採用暗黑 glassmorphism 設計與 neon glow 霓虹發光美學，提供檔案/函數層級切換、動態霓虹實線、靜態虛線、Slider 篩選、高亮搜尋、拖曳固定、佈局儲存至 `visualizer-layout.json`、一鍵匯出 SVG 功能。
