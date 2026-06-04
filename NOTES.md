# 目前工作進度與摘要 (NOTES.md)

## 1. 目前進度 (最後處理到哪裡)
- **Class 建構函式型別注入 (v1.1.4)**：修復了 `js2ts-infer` 在重構時漏掉建構函式型別標註的問題，將 `types-observed.json` 中 constructor 參數（如 `particles.ts` 中的 `x: number, y: number, color: string`）精確寫入 TS 檔。
- **目錄匯出與非侵入式重構 (v1.1.6 - v1.1.7)**：實作 `generate` 指令支援 `--in-dir` 與 `--out-dir`，允許將重構產物輸出至指定目錄而不受來源目錄污染，並實作「複製品質增量保護」，不覆寫已存在的同名自訂檔案（但會強制覆寫 AST 轉換出來的全新 `*.ts` 檔案）。
- **Vite 8 與 Node 22 相容 (v1.1.8)**：移除 Node 22 啟動時的 `--no-experimental-require-module` 禁用旗標，順利解決舊版 CommonJS 設定檔或 Vite 8 在 ESM context 下載入時引發的 `ERR_REQUIRE_ESM` 崩潰問題。
- **提升 Class Fields 安全性與空泛型清洗 (v1.1.9 - v1.2.0)**：在 Class properties 搬移中，過濾同名 Method 衝突、重複宣告、依賴 `this.` 的實例表達式；並加入 `<>` 轉換為 `<any>` 的清洗防禦，消除 Vite 的編譯語法解析崩潰。

## 2. 當前重點 (核心內容)
- **非同步函數呼叫關係鏈 (Call Graph) 收集與視覺化**：
  - **動態收集**：在 runtime trace 中透過 mock `callStack` 以及非同步/callback 的 `parentCaller` 閉包代理，記錄「檔案-函數」之間的呼叫次數（Call Count）。
  - **靜態分析與 Scan 結合**：在 `js2ts-infer scan` 階段，即可靜態確認大部分的關聯關係。分析機制如下：
    - **檔案依賴**：掃描檔案最頂層的 `ImportDeclaration` 與 `require()` 呼叫，100% 精準繪出模組間的依賴。
    - **函數依賴**：在 AST 遍歷中解析 `CallExpression`。若呼叫對象為同檔案宣告的函數，或屬於導入模組的具名導出（如 `import { foo }` 且呼叫 `foo()`），即可靜態標記其潛在呼叫關係。若為模組方法調用（如 `utils.bar()`），亦可靜態關聯至目標檔案的 `bar` 函數。
    - 這些靜態依賴關係將直接輸出在 `boundary-map.json` 中，並可於視覺化圖表中呈現為 **虛線**；之後與動態側錄資料（實線 + 次數）無縫合併。
  - **HTML/SVG 視覺化樣版**：建立一個搭載 D3.js 的互動圖表網頁，提供使用者可手動拖曳定位 SVG 節點、搜尋、過濾、並切換檔案/函數層級。

## 3. 待處理事項 (接下來要做什麼)
- **[ ] 實作 Call Graph 收集與視覺化**：
  1. **插樁修改 (`babel-plugin-js2ts.ts`)**：於所有函數頂端插入 `globalThis.__typeTracker.enter("file::func")` 的呼叫。
  2. **客戶端代理 (`tracker-client.ts`)**：維護全域 `callStack` 陣列，非同步 wrapFunction 閉包捕捉當下的 caller 並壓入執行上下文。
  3. **靜態分析與 Scan 擴充 (`static-analyzer.ts`)**：於 `scan` 階段掃描 AST，解析 `ImportDeclaration` / `require` 與 `CallExpression` 以偵測潛在呼叫關係，輸出至 `boundary-map.json`。
  4. **視覺化檢視工具 (`visualizer.ts / visualizer.html`)**：D3.js 力導向圖繪製與伺服器 Serve。
- **[ ] 執行其餘專案轉換與 Review**：對剩餘專案執行重構並以 `js2ts-infer review` 細修 `any`。

## 4. 進階加強與防禦設計確認 (重點防護)
1. **呼叫棧出錯容錯與自動校正 (Error Recovery)**：
   - 由於 JavaScript 中有非預期之 `throw error` 或 `process.exit`，可能導致對應的 `exit` 插樁未被執行。
   - **防禦**：`exit(funcId)` 不採用直接 pop，而是搜尋 `callStack` 並自該索引往後一次性清理，自動移除因例外中斷而殘留的錯誤棧層。
2. **遞迴呼叫限制 (Recursion Depth Limit)**：
   - 避免遞迴函數引發模擬呼叫棧無限增長。
   - **防禦**：當 `callStack.length` 超過預設最大長度（如 200）時，不再推入，以防止記憶體溢出。
3. **高頻函數過濾機制 (High-Frequency Filter)**：
   - 對於遊戲循環（如 `requestAnimationFrame`）或高頻率的純運算工具（例如 `Math`、解碼模組），插樁會帶來輕微的性能損耗。
   - **加強**：在 `js2ts.config.json` 中提供 `excludeCallGraph` 排除模式，支援對特定檔案或匹配字元跳過 Call Graph 插樁。
4. **專案視覺化佈局存檔 (Layout Retention)**：
   - D3.js 力導向圖每次重開時，節點位置預設會重新漂移。
   - **加強**：提供「儲存布局」功能，當使用者手動將節點拖曳固定在完美位置後，可點擊儲存，將坐標寫入當前專案的 `visualizer-layout.json`，下次開啟時直接載入以保留排版。

## 5. 核心設定 (需要保持的風格與規範)
- **依賴管理**：一律使用 `pnpm` 工具。
- **語系要求**：所有對話、回覆、說明文件及歷史紀錄（`Releases.md`、`task.md`、`implementation_plan.md`）均須使用 **繁體中文**。
- **記錄規範**：每次對話有任何代碼變更或重構大綱，都必須同步更新至根目錄的 [Releases.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/Releases.md)。

---

# 視覺化 HTML/SVG 樣版細節規範

我們將使用 **D3.js v7** 建構內嵌的視覺化架構圖網頁，其核心技術與設計細節如下：

### 1. UI 介面與毛玻璃霓虹美學 (Aesthetics)
- **主視覺**：採用高質感 Dark Mode 暗黑背景（`#0a0f1d` 到 `#151e3d` 的漸層背景）。
- **控制面板 (Glassmorphism Panel)**：使用 `backdrop-filter: blur(12px)` 的毛玻璃懸浮控制面板，配置於網頁左側或右上方。
- **發光效果 (Neon Glow)**：在 SVG 中宣告 `<filter id="glow">` 濾鏡，對活躍的動態連線與節點套用 `feGaussianBlur` 產生霓虹發光感。

### 2. D3.js 力導向圖設定 (Force Simulation)
- **力學參數**：
  - `d3.forceManyBody().strength(-300)`：避免節點擠成一團。
  - `d3.forceCollide().radius(d => d.radius + 15)`：碰撞半徑防重疊。
  - `d3.forceLink().distance(120)`：力導向連結距離。
- **拖曳固定 (Drag & Drop to Fix)**：
  - 綁定 `d3.drag()`，在拖曳中更新節點坐標：`d.fx = event.x; d.fy = event.y;`。
  - **拖曳結束後不釋放**（即不將 `d.fx`、`d.fy` 設回 `null`），讓節點永久固定在使用者拖曳過的位置，便於手動完美排版。
  - 提供 **[重置所有節點位置]** 按鈕，點擊後釋放所有固定位置，重新啟動彈力布局。

### 3. 連線與節點渲染機制 (Links & Nodes)
- **依賴模式切換** (可動態 toggle)：
  - **檔案級模式 (File-level)**：節點代表整個 `.js/.ts` 檔案，連線為彙整後的模組間依賴，並累加該檔案內所有的呼叫總數（Call Count）。
  - **函數級模式 (Function-level)**：節點精細至具體的 `function` 或 Class 中的 `method`。
- **動態呼叫 (Dynamic Edge)**：
  - 渲染為 **實線**，並套用霓虹發光濾鏡。
  - 連線粗細與發光強度與 `count`（呼叫次數）呈正相關。
- **靜態呼叫 (Static Edge)**：
  - 渲染為 **虛線** (`stroke-dasharray="5,5"`)，代表未被執行到的潛在關係，顏色為半透明淡灰色，無發光。
- **方向箭頭**：連線末端使用 SVG `<marker>` 繪製箭頭指向被呼叫方。
- **節點分類配色**：依據相對路徑的資料夾分類（例如 `src/engine/` 著青綠色、`src/state/` 著亮粉色、`src/` 著金黃色）。

### 4. 控制與過濾功能
- **畫布縮放與平移 (Zoom & Pan)**：支援滑鼠滾輪縮放與畫布拖曳平移。
- **呼叫次數篩選 (Count Slider)**：滑動條可動態隱藏低於 N 次呼召的連線，過濾雜訊。
- **顯示/隱藏靜態依賴**：切換開關，隱藏所有虛線。
- **高亮搜尋框 (Search Highlighter)**：搜尋檔案或函數名稱，命中後會將該節點及其相連的所有線路高亮，其他無關節點則淡化為半透明。
- **SVG 圖檔匯出 (Export SVG)**：一鍵打包 SVG DOM 的 `outerHTML`（含 CSS style 與定義的 SVG filter），讓使用者可以直接保存或列印高解析度架構圖。
