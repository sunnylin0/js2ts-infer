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
- **「類別級」視覺化架圖**：於 `templates/visualizer.html` 新增「類別級 (Class-level)」檢視選項。前端將側錄資料中含有點號的追蹤 ID 予以切割聚合至各自 of Class 節點，成功繪製出類別與類別間的動靜態呼叫關係。

---

## [2026-06-05] v1.4.1 - 修正轉換後 4_abcTS 的開發環境配置

- **關閉開發期型別側錄以阻斷干擾**：在 `4_abcTS/vite.config.ts` 中將 `vitePlugin` 註解關閉，以防一般開發模式下因無法載入背景收集伺服器（9002 連接埠）而拋出 `globalThis.__typeTracker is not a function` 錯誤，確保 `editor.html` 與相關頁面可正常載入與運作。
- **調整 Vite Config 規範**：修正 `vite.config.ts` 的 `server` 配置，將其從 `build` 下層移至與 `build` 同級的頂層配置，使瀏覽器能在伺服器啟動時正常開啟，並修正 Entry 為 `index.ts`。

---

## [2026-06-05] 技術解答 - pnpm 工具包設計與導入配置

- **套件封裝設計**：設計 `js2ts-infer` 套件的 `package.json` `exports` 配置，將 `vitePlugin` / `webpackLoader` 等前端插樁插件隔離至 `js2ts-infer/plugins` 的子導出路徑。
- **配置導入示範**：說明在 `vite.config.js` 中將相對路徑取代為 `import { vitePlugin } from 'js2ts-infer/plugins'` 的具體寫法。

---

## [2026-06-05] 技術解答 - Conditional Exports 與型別導出配置

- **條件導出優化**：建議將一般的 `exports` 升級為 Conditional Exports，並加入 `types` 導出分支，使其他 TypeScript 專案（如 `vite.config.ts`）在導入 `js2ts-infer/plugins` 時能獲得完整的 IDE 型別提示與編譯支援。

---

## [2026-06-05] v1.4.2 - 啟用並支持 TypeScript 宣告檔 (*.d.ts) 輸出與條件導出

- **啟用 tsconfig 宣告檔編譯輸出**：於 `tsconfig.json` 配置中啟用 `"declaration": true`，使 `tsc` 執行編譯時自動為所有程式產生型別定義宣告檔 `*.d.ts` 至 `dist/` 目錄。
- **補完 package 條件型別導出**：重構 `package.json` 中的 `exports` 物件，明確劃分並指向 `types` 與 `default` 分支（例如 `"types": "./dist/plugins.d.ts"`），保證其他 TypeScript 客戶端（如 `vite.config.ts`）在引用的同時能享有完整的 IDE 智慧語法提示。

---

## [2026-06-05] v1.4.3 - 於 generate 中排除轉譯 `vite.config` 與 `webpack.config`

- **設定檔轉譯排除過濾**：升級 `generate` 的程式碼生成器（`src/code-generator.ts`）。在遍歷待重構的檔案列表時，自動過濾並跳過所有檔名主體為 `vite.config` 或 `webpack.config` 的設定檔案（例如 `vite.config.js`、`webpack.config.js` 等）。這能確保在重構專案時，前端的各類建置設定檔可原樣完整保留且不會被不當重構為 `.ts` 檔案，有效避免建置管線因副檔名改變而中斷。

