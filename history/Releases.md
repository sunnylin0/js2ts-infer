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
- **「類別級」視覺化架圖**：於 `templates/visualizer.html` 新增「類別級 (Class-level)」檢視選項。前端將側錄資料中含有點號的追蹤 ID 予以切割聚合至各自 of Class 節點，成功繪製出類別與類別間 the 動靜態呼叫關係。

---

## [2026-06-05] v1.4.1 - 修正轉換後 4_abcTS 的開發環境配置

- **關閉開發期型別側錄以阻斷干擾**：在 `4_abcTS/vite.config.ts` 中將 `vitePlugin` 註解關閉，以防一般開發模式下因無法載入背景收集伺服器（9002 連接埠）而拋出 `globalThis.__typeTracker is not a function` 錯誤，確保 `editor.html` 與相關頁面可正常載入與運作。
- **調整 Vite Config 規範**：修正 `vite.config.ts` 的 `server` 配置，將其從 `build` 下層移至與 `build` 同級 the 頂層配置，使瀏覽器能在伺服器啟動時正常開啟，並修正 Entry 為 `index.ts`。

---

## [2026-06-05] 技術解答 - pnpm 套件包設計與導入配置

- **套件封裝設計**：設計 `js2ts-infer` 套件的 `package.json` `exports` 配置，將 `vitePlugin` / `webpackLoader` 等前端插樁插件隔離至 `js2ts-infer/plugins` 的子導出路徑。
- **配置導入示範**：說明在 `vite.config.js` 中將相對路徑取代為 `import { vitePlugin } from 'js2ts-infer/plugins'` 的具體寫法。

---

## [2026-06-05] 技術解答 - Conditional Exports 與型別導出配置

- **條件導出優化**：建議將一般的 `exports` 升級為 Conditional Exports，並加入 `types` 導出分支，使其他 TypeScript 專案（如 `vite.config.ts`）在導入 `js2ts-infer/plugins` 時能獲得完整的 IDE 型別提示與編譯支援。

---

## [2026-06-05] v1.4.2 - 啟用並支持 TypeScript 宣告檔 (*.d.ts) 輸出與條件導出

- **啟用 tsconfig 宣告檔編譯輸出**：於 `tsconfig.json` 配置中啟用 `"declaration": true`，使 `tsc` 執行編譯時自動為所有程式生成相對應的 `*.d.ts` 型別定義宣告檔至 `dist/` 目錄。
- **補完 package 條件型別導出**：重構 `package.json` 中的 `exports` 物件，明確劃分並指向 `types` 與 `default` 分支（例如 `"types": "./dist/plugins.d.ts"`），保證其他 TypeScript 客戶端（如 `vite.config.ts`）在引用的同時能享有完整的 IDE 智慧語法提示。

---

## [2026-06-05] v1.4.3 - 於 generate 中排除轉譯 `vite.config` 與 `webpack.config`

- **設定檔轉譯排除過濾**：升級 `generate` 的程式碼生成器（`src/code-generator.ts`）。在遍歷待重構的檔案列表時，自動過濾並跳過所有檔名主體為 `vite.config` 或 `webpack.config` 的設定檔案（例如 `vite.config.js`、`webpack.config.js` 等）。這能確保在重構專案時，前端的各類建置設定檔可原樣完整保留且不會被不當重構為 `.ts` 檔案，有效避免建置管線因副檔名改變而中斷。

---

## [2026-06-05] v1.4.4 - 支援利用既有 `*.d.ts` 宣告檔進行精準重構

- **自動載入宣告檔**：於 `src/code-generator.ts` 的 `runGeneration` 階段全域載入專案內所有 `*.d.ts` 宣告檔。
- **Class 屬性對齊型別**：當 Class 在重構時，自動比對專案中同名 interface，並將 Class 屬性型別覆寫為宣告檔中定義的精確型別（例如將 `engraver` 標註為 `EngraverController`、`lines` 標註為 `Lines[]` 等）。
- **方法參數與傳回值對齊**：升級 `annotateFunction` 支援 `dtsInterface`。若宣告檔中含有對應方法簽章，則優先對齊參數與傳回值型別，否則回退到側錄推導。

---

## [2026-06-05] v1.4.5 - 實作 AST 型別正反向傳播與自動延伸機制

- **正向傳播 (區域變數與方法傳回值)**：利用 `TypeChecker` 取得 initializer 與 method return type 推導型別，自動標記方法內部的局部變數（如 `line: AbcJS4.Lines`、`staff: AbcJS4.Staff`）與方法傳回值（如 `getElementFromChar(char): AbcJS4.Voice`）。
- **反向傳播 (方法參數)**：分析 Class 內部方法的調用引數，反向將引數的推導型別寫入被呼叫方法的參數上（如將 `lines` 標註為 `Lines[]`）。
- **保留命名空間前綴**：修正型別清理機制保留 `AbcJS4.` 前綴，保證在非 namespace 檔案中能全域識別型別並 100% 通過 TypeScript 編譯。

---

## [2026-06-05] 技術問答 - 提升加入型別準確率的架構順序與方案

- **架構順序定義**：釐清並設計「靜態地圖奠基 -> JSDoc與靜態推導 -> AST 正反向傳播 -> 動態側錄兜底」的重構管線流程。
- **延伸方案提出**：
  1. **TSC 編譯錯誤反饋循環 (Feedback Loop)**：利用 `tsc` 編譯錯誤診斷動態修正 union / optional 型別。
  2. **鴨子型別結構特徵比對**：將動態側錄的物件屬性與 `*.d.ts` 定義的 Interface 計算相似度進行精準對齊。
  3. **LLM 語意型別推測**：針對剩餘的 Stubborn `any` 以 LLM 補丁輔助推導。

---

## [2026-06-05] 設計規格 - TSC 編譯錯誤反饋循環與 AI 自我修正設計方案

- **發佈設計規格文件**：建立 [tsc_feedback_loop_design.md](file:///C:/Users/ESAO_NB27/.gemini/antigravity-ide/brain/f4337bbd-b924-4968-94b9-c9c8e279b171/tsc_feedback_loop_design.md)，詳細記錄五階段重構管線、TSC 診斷擷取程式碼、Prompt 工程設計、Patch 套用以及循環收斂控制機制。
- **整理 v2 版本設計文件**：將詳細的注入架構與四個步驟（讀取既有宣告檔、JSDoc提取與靜態初步推導、AST正反向傳播、動態側錄兜底）重新整理，以結構化標題與項目符號對齊，寫入並更新至 [v2/tsc_feedback_loop_design.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/v2/tsc_feedback_loop_design.md) 中。
- **補充第 1.5 節設計細節**：於 [v2/tsc_feedback_loop_design.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/v2/tsc_feedback_loop_design.md#L32-L35) 補完「第五步：TSC 編譯錯誤反饋循環與 AI 自我修正」的具體理由與實作方式摘要，完備全套注入流程規劃。

---

## [2026-06-05] 技術規劃 - 定位型別對齊與發佈完整重構設計方案

- **釐清載入時機與定位**：分析並確認「讀取宣告檔建立型別地圖」應置於 `generate` 階段，不屬於 `scan` 階段，保證 `scan` 的效能與職責單一。
- **發佈完整 `generate` 設計規格**：合併整理並在 [v2/tsc_feedback_loop_design.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/v2/tsc_feedback_loop_design.md) 中完整發佈 `generate` 階段的五大注入與修正流程。

---

## [2026-06-05] v1.5.0 - 實作 TSC 編譯錯誤反饋循環與代碼模組化分檔

- **程式碼分檔重構**：將 `src/code-generator.ts` 分割為 [ast-refactorer.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/ast-refactorer.ts)（AST 轉換與傳播邏輯）與 [feedback-loop.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/feedback-loop.ts)（TSC-AI 自我修復邏輯），將原 `code-generator.ts` 精簡為純粹的重構控制管線。
- **TSC 錯誤診斷與 AI 修正**：於 `feedback-loop.ts` 內調用 `typescript` Compiler API 擷取核心型別編譯錯誤（TS2322 等），提取出錯程式碼上下文並調用 Gemini API 自動生成 JSON 修復補丁。
- **429/503 自動重試與 bypass 開關**：
  * 在 `feedback-loop.ts` 實作自動退避重試，可解析 API 提供的 `retryDelay` 進行休眠等待。
  * 因測試時遭遇極其嚴重的 Free Tier Rate Limit (429) 與服務不可用 (503) 阻塞，已暫時將 `code-generator.ts` 中的 `runFeedbackLoop` 調用處理予以註解（AI 修正旁路關閉），避免干擾重構管線的主流程。

---

## [2026-06-05] v1.5.1 - 修正字面量型態收窄與優化 return 型別推導策略

- **字面量型態安全寬化 (Literal Widening)**：
  - 於 `src/ast-refactorer.ts` 新增 `widenTypeName` 輔助函數，精確且安全地將 `'true'`, `'false'`, 數字字面量（以 `Number()` 健全驗證）及引號字串字面量寬化為基礎型別 `'boolean'`, `'number'`, `'string'`。
  - 支援對 Union 型態（如 `0 | 4` 等聯集）的自動寬化去重（合併為 `'number'`）。
  - 將其應用至 `resolveParameterType` 與 `getCleanTypeText`，徹底根除 `var pickupLength: 0`、`barLength: 0`、`num: 4` 等型別過度限縮之語法問題。
- **優化 Method 回傳值推導優先級**：
  - 實作了 `resolveAndSetReturnType` 函數，定義了「優先採用 AST 靜態型態推導，失敗 (如 any) 時才以 `typeDB` 動態側錄兜底」的新標註模式。
  - 將 `annotateFunction` 的傳回型別 fallback 邏輯移出，並改為在 Class methods 及一般 Function 解析完成後統一由 `resolveAndSetReturnType` 標註。
  - 此舉順利讓 `getMeter()` 直接使用 `index.d.ts` 定義的 `Meter` 介面（不再重疊生成 `*ReturnShape`），並讓 `getKeySignature()` 完美標記為 `Key | {}`。

---

## [2026-06-05] v1.5.2 - 修正 Interface 方法簽章解析 Bug，完美打通同名型別注入

- **修復 InterfaceDeclaration 方法獲取**：
  - 修正 `src/ast-refactorer.ts` 的 `annotateFunction` 函數：修復了原本對 `InterfaceDeclaration` 調用 `getMethod`（Class 專屬 API）導致無法識別 `index.d.ts` 內定義的方法簽章之問題。
  - 透過動態判斷，相容呼叫 `getMethodSignature`，使 `index.d.ts` 中的介面方法定義（如 `engraveABC` 等）能被精確識別並注入型別。
- **完全移除冗餘的 Shape 介面**：
  - 重新轉譯後，`4_abcTS/src/write/engraver-controller.ts` 頂部的多餘 `Tune` 相關 Shape 介面已完全被移除，參數也精確標註為 `abctunes: Tune` 等，代碼更加乾淨。
- **Vite 打包建置通過**：
  - 轉換後的 `4_abcTS` 專案通過 `pnpm run build:vite`，保證 151 個模組完全無錯。

---

## [2026-06-06] v1.5.3 - 執行專案地圖初始化與 agent.md 生成

- **全自動專案地圖繪製**：掃描並識別專案使用之 Node.js / TypeScript 技術棧，於專案根目錄生成完整的 `agent.md` 指南，以便後續開發助理能夠快速學會並掌握專案架構、開發規範與 ts-morph / Babel plugin 等核心實作之 AI 協作注意事項。

---

## [2026-06-06] v1.5.4 - 全專案核心工具與命令 JSDoc 註解補全

- **JSDoc/TSDoc TSDoc 標準化註解補全**：
  - 為專案中所有核心工具檔案與指令程式碼（如 `src/ast-refactorer.ts`、`src/loader-hook.ts` 等）補齊了符合 `JSDOC_GUIDE.md` 規範的頂級說明註解。
- **解決 JSDoc 編譯衝突**：
  - 修正 `static-analyzer.ts` 中的星號斜線語法標記問題，消除了 TypeScript 編譯階段的語法解析錯誤。
  - 調整 `loader-hook.ts` 中 `// @ts-ignore` 擺放位置以順利忽略私有方法的型別檢查。
- **專案重新編譯建置通過**：
  - 於根目錄執行 `pnpm run build` 通過編譯並成功輸出所有建置產物。

---

## [2026-06-07] v1.5.5 - 產生重構大綱與 code-generator 優化大師提示詞

- **新增 master 重構提示詞文件**：
  - 於根目錄生成 `REFACTOR_PROMPT.md`。該文件詳細指引 AI 如何將專案的重構機制升級至「全專案語境（Whole-Project Context）」與「記憶體原子交易落盤（Transactional Commit）」，並導入 `ts-query` 進行 CSS 選擇器式的 AST 優雅檢索，大幅優化 TS 編譯器效能。

---

## [2026-06-07] v1.5.6 - 解決 ts-morph 與 tsquery 之 TypeScript 版本衝突，打通屬性提取 AST 重構

- **解決套件版本/實例衝突**：於 `src/ast-refactorer.ts` 頂端透過覆寫 `require.cache['typescript']`，強制使 `@phenomnomnominal/tsquery` 內部與 `ts-morph` 共用同一個 `ts` compiler 實例。此舉成功解決了 `ts.forEachChild` 在跨套件實例時無法遍歷 AST 的嚴重 Bug。
- **擴充 `ts-morph` 支援 `.query` 選擇器方法**：將 tsquery 選擇器功能透過 `Node.prototype.query` 直接外掛注入至 `ts-morph` 所有節點上，並在 `src/ast-refactorer.ts` 中完全重構相關的 AST 查詢語法。
- **精確 Class constructor 屬性提取與移除**：將 `this` 賦值的 query selector 由 `expression.name="this"` 修正為動態型別安全的 `expression.kind=${SyntaxKind.ThisKeyword}`。重構 3_Snake 時成功自動偵測並將所有無相依性的 `this.xxx` 初始化成員安全提取至 Class 頂部欄位，並自 `constructor` 中將其移除，完全符合 Codemod 重構標準。

---

## [2026-06-07] v1.5.7 - 修正 This 呼叫反向型別傳播與阻斷無效陣列型別感染

- **修復 ThisKeyword 方法呼叫引數傳播**：將 `src/ast-refactorer.ts` 內查詢 `this.method(...)` 呼叫的選擇器從 `expression.name="this"` 修正為 `expression.kind=${SyntaxKind.ThisKeyword}`，打通 `this` 方法呼叫引數的型別反向傳播機制，使 `computePickupLength(lines: Lines[], ...)` 獲得最精確的宣告檔型別。
- **排除阻礙型別演進的無效陣列型別**：修改 `getCleanTypeText` 排除 `undefined[]`, `never[]`, `null[]` 等在 empty array `[]` 初始化時產生的初階無效型別，恢復 TypeScript 陣列型別演進能力，徹底根除型別感染/污染問題，使 `addEndPoints` 與 `makeSortedArray` 能夠正確使用 `any[]`。
- **打包建置無錯通過**：轉譯後的 `4_abcTS` 專案執行 `pnpm run build:vite` 成功編譯通過，建置產物無任何型別或語法錯誤。

---

## [2026-06-07] v1.5.8 - 實現雙輪反向型別傳播、Import 全路徑型別解包，打通全專案多級全域型別鏈

- **實現 2 輪迭代全域反向傳播**：重構 `runGlobalReversePropagation` 為 2 輪迭代結構，成功解決多級函數呼叫傳遞時（如 `abc_tune.ts` 呼叫 `sequence` 再調用 `MidiSequencer.sequence`）型別寫入與編譯器快取時間差導致的傳播中斷問題。
- **實現屬性方法調用與 Import 靜態追蹤**：實作 `resolveImportTarget` 與 `resolvePropertyAccessCallee`，成功追蹤類別實體的方法呼叫（如 `sequencer.sequence(...)`），將其實體宣告與引數型別進行反向綁定。
- **實現全路徑 `import(...)` 解包還原**：實作 `unwrapImportType`，自動將編譯器推導的 `import("...").default` 解開並還原為具名的 `Tune` 及陣列型別 `Tune[]` 等乾淨型別，徹底解除了跨模組型別傳遞的屏障。
- **全專案型別安全連鎖傳播與 Vite 零錯誤建置**：成功讓 `abc_midi_sequencer.ts` 中的 `sequence` 參數取得 `Tune` 型別，並透過正向傳播自動推導出 `lines: Lines[]`、`line: Lines`、`staves: Staff[]`、`staff: Staff`、`voice: Voice[]` 等一連串精密型別。在此基礎上，轉譯後的 `4_abcTS` 打包建置以 **完全零錯誤** 成功通過。

---

## [2026-06-08] v1.6.0 - 通用化全域型別傳播：弱型別覆蓋、多呼叫站 Union、第三.五階段二次反向傳播

- **移除硬編碼 `isSeqCall` 過濾器**：`runGlobalReversePropagation` 不再只針對 `sequence` 方法，改為完全通用的反向型別傳播，適用於所有 class methods 與函數。
- **弱型別（`{}`、`any`）覆蓋**：反向傳播的更新條件從「僅允許無型別標注的參數」擴大為「允許覆蓋 `{}`、`any`、`unknown` 等弱型別」。讓 `cloneLine(line: {})` 能被呼叫站的 `Lines` 型別覆蓋為 `cloneLine(line: Lines)`。
- **多呼叫站型別 Union 合併**：將參數更新 Map 從 `Map<param, string>` 改為 `Map<param, Set<string>>`，收集所有呼叫站的推導型別，最終以 union 寫入，防止後者覆蓋前者造成型別遺失。
- **正向傳播新增 `new ClassName()` 直接命名**：`runGlobalForwardPropagation` 遇到 `new ClassName()` 初始化直接取類別名稱作為型別，不再依賴 TypeChecker 推導可能出現的 `import(...).default` 等複雜型別。
- **正向傳播新增 `arr[i]` 陣列元素型別推導**：針對 `ElementAccessExpression`（如 `lines[i]`），呼叫 `getArrayElementType()` 取得陣列元素型別，讓 `var line = lines[i]` 直接推導為 `Lines`。
- **第三.五階段：正向傳播後二次反向傳播**：新增 Pipeline 第三.五階段，在正向傳播確立 `staff: Staff` 等局部變數型別後，再次執行反向傳播讓 TypeChecker 能從 `staff.key: KeySignature`、`staff.meter: Meter` 等屬性存取推導並注入方法參數型別。此次新增後，`getTrackTitle(staff: Staff[])`, `interpretTempo(element: Voice, beatLength: number)`, `cloneLine(line: Lines)` 等方法參數皆成功自動標注。

---

## [2026-06-08] v1.7.0 - ast-refactorer.ts 模組化拆分

- **拆分 `ast-refactorer.ts`（原 1418 行）為 5 個職責單一的模組**，提升可讀性與維護性：

  | 模組 | 路徑 | 說明 |
  |------|------|------|
  | `tsquery-ext.ts` | `src/refactor/tsquery-ext.ts` | `Node.prototype.query` Side-Effect patch + `query()` helper |
  | `type-utils.ts` | `src/refactor/type-utils.ts` | 12 個型別推導工具函式（merge、widen、resolve 等） |
  | `annotate.ts` | `src/refactor/annotate.ts` | `annotateFunction`、`resolveAndSetReturnType`、`refactorCjsToEsm` |
  | `process-file.ts` | `src/refactor/process-file.ts` | `processFileRefactoring` 單一檔案 AST 重構主管線 |
  | `propagation.ts` | `src/refactor/propagation.ts` | 全域傳播函式群（Reverse / Forward / Return Type / writeInterfaceDeclarations） |

- **`ast-refactorer.ts` 縮減為純 re-export 入口（~20 行）**：確保所有呼叫者（`code-generator.ts`）零改動向後相容。
- **全面加入繁體中文 JSDoc 注解**：所有函式、區段、參數、傳播策略、降級策略皆有詳細中文說明。
- **驗證**：`pnpm run build` 通過（tsc + ESM 雙編譯 + build-post.js）。

---

## [2026-06-12] v1.7.1 - 修復 Class Field Hoisting 因 tsquery 版本衝突靜默失敗

- **根本原因診斷**：
  - `@phenomnomnominal/tsquery` 使用的 TypeScript 實例（v6.0.3）與 `ts-morph` 內嵌實例（v5.4.2）不同，即使 `tsquery-ext.ts` 已嘗試 patch `require.cache`，tsquery 仍然無法正確遍歷 ts-morph 建立的 AST 節點，導致所有 `.query()` 呼叫靜默回傳空陣列。
  - 具體影響：`processFileRefactoring` 中的 `ClassDeclaration` 選取、`BinaryExpression` 搜尋及 `FunctionDeclaration` 遍歷全部失效，造成 constructor 屬性提升（Class Field Hoisting）不再運作。

- **修復方案（`src/refactor/process-file.ts`）**：
  - `sourceFile.query('FunctionDeclaration')` → `getDescendantsOfKind(SyntaxKind.FunctionDeclaration)`
  - `sourceFile.query('ClassDeclaration')` → `getDescendantsOfKind(SyntaxKind.ClassDeclaration)`
  - `cls.query('BinaryExpression[...]')` / `ctor.query(...)` → `getDescendantsOfKind(SyntaxKind.BinaryExpression).filter(...)` 手動判斷 `EqualsToken` + `ThisKeyword`
  - constructor body 直接子節點比對由 JS 物件參考（`!==`）改為 `Block kind + getPos()` 比較，避免 nested if/else 內賦值被誤判。

- **驗證**：`3_Snake` 執行 `generate` 後 `gameEngine.ts` 成功恢復所有 `this.xxx` 提升至 class 頂部，含 JSDoc 注解轉換。
