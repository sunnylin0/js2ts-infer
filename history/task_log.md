# 任務進度追蹤

---
**時間戳記**：2026-06-04 16:16:00

- [x] 修正 `resolveParameterType` 清除空泛型 (`Array<>`)
- [x] 編譯專案 `pnpm run build`
- [x] 執行 `js2ts-infer generate` 覆蓋 `4_abcTS`
- [x] 驗證 `4_abcTS/src/parse/tune-builder.ts` 及 `4_abcTS/src/synth/synth-controller.ts` 的型別生成正確性
- [x] 於 `4_abcTS` 目錄下跑 `pnpm run dev` 驗證 Vite 是否順利啟動

---

# 任務進度追蹤

**時間戳記**：2026-06-04 16:49:00

- [x] 呼叫關係鏈 (Call Graph) 收集與視覺化
  - [x] 擴充 `src/commands/init.ts` 支援 `excludeCallGraph` 設定
  - [x] 註冊 `visualize` 指令到 `src/cli.ts`
  - [x] 於 `src/static-analyzer.ts` 實作靜態 Imports、Requires 與 CallExpression 掃描
  - [x] 於 `src/tracker-server.ts` 支援 `__callGraph` 的特別合併與持久化
  - [x] 於 `src/type-merger.ts` 支援多端 `__callGraph` 的無損合併
  - [x] 修改 `src/babel-plugin-js2ts.ts` 實現進入/離開插樁，並整合高頻篩選器
  - [x] 升級 `src/tracker-client.ts` 實作 `callStack` 追蹤、Error Recovery、非同步/Callback `parentCaller` 閉包代理
  - [x] 實作 `src/commands/visualize.ts` 網頁伺服器及 API 端點
  - [x] 實作 `src/templates/visualizer.html` D3.js v7 霓虹互動架構圖
  - [x] 使用 `3_Snake` 專案執行靜態掃描與執行期側錄，確認 `boundary-map.json` 與 `types-observed.json` 中包含呼叫鏈
  - [x] 執行 `visualize` 啟動 9003 連接埠，測試畫布平移、節點拖曳固定、佈局儲存、圖表切換與 SVG 匯出

---

# 任務進度追蹤

**時間戳記**：2026-06-04 17:16:00

- [x] 類別級 (Class-level) Call Graph 關係鏈收集與視覺化
  - [x] 於 `src/static-analyzer.ts` 實作雙階段掃描以識別靜態類別依賴，輸出 `staticCallGraph.classes`
  - [x] 修改 `src/babel-plugin-js2ts.ts` 的 `getFunctionName` 為類別方法與類別欄位 ArrowFunction 加入 `ClassName.` 前綴
  - [x] 修改 `src/code-generator.ts` 對齊類別方法 `ClassName.methodName` 規格，並在 `annotateFunction` 中清洗 interface name
  - [x] 於 `src/templates/visualizer.html` 新增「類別級 (Class-level)」檢視模式與圖表建構邏輯
  - [x] 使用 `3_Snake` 專案執行靜態掃描與執行期側錄，確認 `boundary-map.json` 與 `types-observed.json` 中包含類別級依賴與類別前綴
  - [x] 執行 `generate` 重構代碼，確認生成無錯
  - [x] 啟動視覺化工具，測試切換至「類別級」的顯示與佈局保存功能

---

# 任務進度追蹤

**時間戳記**：2026-06-04 17:26:00

- [x] 類別級 (Class-level) Call Graph 關係鏈收集與視覺化任務已全面完成並成功驗證。

---

# 任務進度追蹤

**時間戳記**：2026-06-05 09:16:00

- [x] 修正重構後的 4_abcTS 開發與打包設定
  - [x] 於 `4_abcTS/vite.config.ts` 註解 `vitePlugin` 以防一般開發模式下因型別伺服器未啟動而產生的 `globalThis.__typeTracker is not a function` 錯誤
  - [x] 將 `server` 設定搬移至最頂層，對齊 Vite 標準配置
  - [x] 將 `build.lib.entry` 入口路徑指向重構後的 `index.ts`
  - [x] 驗證 `pnpm run build:vite` 通過

---

# 任務進度追蹤

**時間戳記**：2026-06-05 09:27:00

- [x] 啟用並封裝 TypeScript 宣告檔 (Declaration)
  - [x] 於 `tsconfig.json` 啟用 `declaration: true` 編譯設定
  - [x] 於 `package.json` 的 `exports` 新增對應的 `types` 分支
  - [x] 重新執行 `pnpm run build`，成功產出所有 `*.d.ts` 檔案並通過建置

---

# 任務進度追蹤

**時間戳記**：2026-06-05 13:26:00

- [x] 於 `js2ts-infer generate` 排除轉譯 config 檔
  - [x] 修改 `src/code-generator.ts`，對檔名包含 `vite.config.` 與 `webpack.config.` 的檔案直接予以跳過
  - [x] 重新編譯專案並執行測試，驗證 `vite.config.js` 檔案確實未被轉譯且安全保留原樣

---

# 任務進度追蹤

**時間戳記**：2026-06-05 13:40:00

- [x] 支援讀取與利用 `*.d.ts` 宣告檔型別進行精準重構
  - [x] 於 `src/code-generator.ts` 中調整 `runGeneration`：在全域建立單一 `Project` 實例，並載入所有 `*.d.ts` 宣告檔
  - [x] 修改 `processFileRefactoring` 以共享全域 `project`，並在結束時移除該 `SourceFile`
  - [x] 實作 `findInterfaceInProject` 以根據 Class 名稱檢索同名 Interface
  - [x] 實作 `getPropertyTypeString` 輔助函數安全取得屬性型別
  - [x] 在 `processFileRefactoring` 中，利用同名 interface 對齊 Class properties 型別（包含新宣告與搬移的屬性）
  - [x] 升級 `annotateFunction` 支援 `dtsInterface`，以優先對齊方法參數與傳回值型別
  - [x] 執行 `pnpm run build` 重新編譯重構工具
  - [x] 對 `4_abc662` 執行 `generate` 測試，驗證 `4_abcTS` 中的屬性與方法型別是否正確對齊 `index.d.ts` 中的定義
  - [x] 驗證轉換後的 `4_abcTS` 能否順利通過編譯與 Vite 開發伺服器啟動

---

# 任務進度追蹤

**時間戳記**：2026-06-05 14:18:00

- [x] 實作 AST 型別正反向傳播與自動延伸機制
  - [x] 於 `src/code-generator.ts` 中實作 `getCleanTypeText` 函數
  - [x] 於 `processFileRefactoring` 的 Class 處理後半段，加入「區域變數正向型別傳播」
  - [x] 加入「方法參數反向型別傳播 (this.method 呼叫分析)」
  - [x] 加入「方法傳回型別推導與自動標註」
  - [x] 執行 `pnpm run build` 重新編譯工具
  - [x] 執行重構 `generate` 產生新版 `4_abcTS`
  - [x] 檢查並驗證 `4_abcTS/src/data/abc_tune.ts` 中的變數與方法型別是否正確延伸（如 `getElementFromChar`、`computePickupLength` 等）
  - [x] 驗證轉換後的 `4_abcTS` 能夠通過 Vite 開發與打包建置

---

## [2026-06-05] 技術問答 - 提升型別準確率之架構與方案評估
- [x] 設計與規劃提升型別準確率的混合架構與執行順序
- [x] 提供基於編譯器診斷 (Feedback Loop)、鴨子型別特徵比對與 LLM 語意推測之具體實作方案

---

## [2026-06-05] 設計規格 - TSC 編譯錯誤反饋循環與 AI 自我修正設計方案
- [x] 撰寫並發佈 [tsc_feedback_loop_design.md](file:///C:/Users/ESAO_NB27/.gemini/antigravity-ide/brain/f4337bbd-b924-4968-94b9-c9c8e279b171/tsc_feedback_loop_design.md) 設計細節文件
- [x] 設計 TSC 錯誤代碼過濾、上下文提取窗口、Prompt 結構及 AST 補丁套用與收斂機制
- [x] 整理並美化 [v2/tsc_feedback_loop_design.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/v2/tsc_feedback_loop_design.md) 中最佳架構順序與實現細節的 Markdown 格式
- [x] 補齊設計文件中 1.5 節的「理由」與「實作方式」內容

---

# 任務進度追蹤

**時間戳記**：2026-06-05 15:05:00

- [x] 釐清 `tsc_feedback_loop_design.md` 設計方案之專案整合步驟（對齊於「步驟 5. generate」）
- [x] 評估並確認型別地圖字典建立不應置於 `scan` 階段而應在 `generate` 階段
- [x] 整合並發佈完整的 [v2/tsc_feedback_loop_design.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/v2/tsc_feedback_loop_design.md) 設計細節文件，詳述 generate 階段五大重構流程細節

---

# 任務進度追蹤

**時間戳記**：2026-06-05 15:15:00

- [x] 實作 TSC 編譯錯誤反饋循環與 AI 自我修正與程式碼分檔
  - [x] 於 `src/commands/init.ts` 的 `DEFAULT_CONFIG` 中加入 `aiApiKey` 等配置
  - [x] 執行 `src/code-generator.ts` 的分檔重構，移出 AST 操作邏輯至 `src/ast-refactorer.ts`
  - [x] 於 `src/feedback-loop.ts` 實作 `runFeedbackLoop`
  - [x] 使用 `typescript` Compiler API 實作程式碼編譯診斷（抓取 TS2322 等核心型別錯誤）
  - [x] 實作上下 15 行上下文擷取與與 `.d.ts` 定義關聯
  - [x] 實作與 Gemini API 通訊，取得並解析 JSON Patch 回傳值
  - [x] 實作 Patch 代碼替換應用邏輯
  - [x] 實作收斂限制（最大 5 次、錯誤數未降中斷、單點 3次嘗試失敗降級 any）
  - [x] 進行本地編譯（`pnpm run build`）並執行 `node dist/cli.js generate` 進行 `4_abcTS` 的 E2E 重構與自我修正驗證
- [x] 依使用者要求暫時關閉（註解）重構時的 AI 自我修正步驟 (第五步) 避免 Free Tier API 429/503 阻塞。

---

# 任務進度追蹤

**時間戳記**：2026-06-05 16:45:00

- [x] 修正變數、參數與傳回值字面量型別 (Literal Type) 過度縮小與 Interface 重複產生問題
  - [x] 於 `src/ast-refactorer.ts` 實作全域 `widenTypeName` 輔助函數，自動將 `0`, `4`, `true`, `false` 等字面量型別（包含聯集型別 `0 | 4` 等）寬化 (Widen) 為基礎型別 `number`, `boolean`, `string`。
  - [x] 更新 `resolveParameterType` 與 `getCleanTypeText` 調用 `widenTypeName`。
  - [x] 調整 `annotateFunction` 職責，使其專注於參數標註與有 dts 定義時的 return 標註，移出無 dts 定義時回退 `typeDB` 的傳回型態設定，避免產生重疊的 `*Shape` 型別。
  - [x] 實作 `resolveAndSetReturnType` 函數，定義「優先採用 AST 靜態型態推導，若無法推導才 fallback 至動態側錄 `typeDB`」之新標註策略，並在 Class 方法與一般 Function/ArrowFunction 處理後統一呼叫。
  - [x] 執行 `pnpm run build` 成功重新建置 CLI。
  - [x] 執行 `node dist/cli.js generate -i ./4_abc662 -o ./4_abcTS -f` 重新重構專案。
  - [x] 驗證 `4_abcTS/src/data/abc_tune.ts` 中的 `computePickupLength`、`getPickupLength`、`getMeterFraction`、`getMeter`、`getKeySignature` 等方法、變數與回傳值之型別均完美且精確地生成。

---

# 任務進度追蹤

**時間戳記**：2026-06-05 17:50:00

- [x] 修復 InterfaceDeclaration 的方法簽章讀取 Bug
  - [x] 修改 `src/ast-refactorer.ts` 內的 `annotateFunction` 函數，將原本僅針對 class 的 `getMethod` 改為動態偵測，並在處理介面時使用 `getMethodSignature` 取得 Interface 的方法簽章定義。
  - [x] 執行 `pnpm run build` 通過。
  - [x] 執行重構生成：`node dist/cli.js generate -i ./4_abc662 -o ./4_abcTS -f`。
  - [x] 驗證 `4_abcTS/src/write/engraver-controller.ts` 的 `engraveABC`、`setupTune`、`engraveTune` 等參數已成功對齊 `Tune` 等強型別，且徹底移除了原本數百行的 `*Shape` 多餘設定。
  - [x] 於 `4_abcTS` 目錄執行 `pnpm run build:vite`，生產建置無錯 100% 通過。

---

# 任務進度追蹤

**時間戳記**：2026-06-06 04:26:00

- [x] 執行 `/init` 全自動專案地圖繪製
  - [x] 掃描 `package.json`, `tsconfig.json`, `pnpm-lock.yaml` 等特徵
  - [x] 產出專案 Blueprint 指南 `agent.md`

---

# 任務進度追蹤

**時間戳記**：2026-06-06 06:33:00

- [x] 為 src 目錄下所有 Function 撰寫頂級 JSDoc 註解
  - [x] 為 `src/commands` 目錄下的所有指令 Function 撰寫頂級 JSDoc 註解
  - [x] 為 `src/` 核心工具檔的所有 Function 撰寫頂級 JSDoc 註解
  - [x] 執行 `pnpm run build` 驗證專案編譯是否成功

---

# 任務進度追蹤

**時間戳記**：2026-06-07 14:09:00

- [x] 安裝 `@phenomnomnominal/tsquery` 依賴
- [x] 重構 `src/code-generator.ts`（全專案記憶體載入與原子落盤）
- [x] 重構 `src/ast-refactorer.ts`（API 簽章優化與整合 ts-query）
- [x] 本地編譯測試與修正編譯錯誤
- [x] E2E 驗證（對 3_Snake 進行 dry-run 與 generate 重構）

---

# 任務進度追蹤

**時間戳記**：2026-06-07 15:00:00

- [x] 解決 `ts-morph` 與 `@phenomnomnominal/tsquery` 底層 `typescript` 模組 instance 衝突
  - [x] 於 `src/ast-refactorer.ts` 加入 `require.cache` 攔截，共用同一 `ts` compiler 實例
- [x] 擴充 `ts-morph` 核心 Node prototype，將選擇器功能外掛至 `.query(selector)` 方法上
- [x] 修正 `this` 賦值之 AST 檢索選擇器為動態型別安全的 `expression.kind=${SyntaxKind.ThisKeyword}`
- [x] 重新編譯建置，並對 `3_Snake` 進行 E2E 測試與驗證，確認 class fields 自動提取與建構子清理皆完美運作

---

# 任務進度追蹤

**時間戳記**：2026-06-07 19:30:00

- [x] 修復 `this.method` 呼叫引數之 AST `tsquery` 選擇器 Bug
  - [x] 將 `expression.name="this"` 修正為 `expression.kind=${SyntaxKind.ThisKeyword}` 確保對 `ThisKeyword` 呼叫引數的型別反向傳播功能生效
- [x] 排解無效的陣列型別標註（`undefined[]`, `never[]`, `null[]` 等）阻礙 TypeScript 陣列型別演進 (Array Type Evolution)
  - [x] 於 `getCleanTypeText` 中過濾並排除這些無效的陣列型別
- [x] 重新編譯重構工具並對 `4_abc662` 進行 E2E 測試與驗證
- [x] 檢查 `4_abcTS/src/data/abc_tune.ts` 中的 `computePickupLength`、`addEndPoints` 與 `makeSortedArray` 等關鍵方法之參數與變數型別，確認已從原先 the `undefined[]` 成功標註為 `Lines[]` 與 `any[]`
- [x] 於 `4_abcTS` 目錄執行 `pnpm run build:vite`，確認專案 100% 通過編譯且無任何 TypeScript 語法錯誤

---

# 任務進度追蹤

**時間戳記**：2026-06-07 23:45:00

- [x] 實現跨模組及多級全域型別傳播與解析
  - [x] 於 `src/ast-refactorer.ts` 實作靜態 Import 追蹤機制 `resolveImportTarget`，打通預設 default 匯入與具名匯入的跨檔案解析。
  - [x] 於 `src/ast-refactorer.ts` 實作 `resolvePropertyAccessCallee` 機制，支援 `sequencer.sequence(abctune, options)` 這類屬性方法調用，解析出正確的類別成員方法實體宣告。
  - [x] 於 `src/ast-refactorer.ts` 實作多級全域型別解析器 `resolveCalleeDeclaration`。
  - [x] 於 `src/ast-refactorer.ts` 實作 `unwrapImportType` 函數，能夠自動將 TS Compiler 回傳的複雜路徑 `import("...").default` 或 `import("...").Tune` 以及其陣列型別 `import("...").default[]` 還原為乾淨的具名型別 `Tune` / `Tune[]` 等。
  - [x] 更新 `getCleanTypeText` 所有呼叫點，傳入 `project` 上下文。
  - [x] 將全專案反向傳播 `runGlobalReversePropagation` 重構為 **雙輪迭代模式**，打通多級反向型別傳遞（如 `abc_tune.ts` 傳遞 `Tune` 給 `sequence` 參數，再傳遞給 `MidiSequencer.sequence` 參數）。
  - [x] 重新編譯建置 `js2ts-infer` 工具。
  - [x] 對 `4_abc662` 執行全專案 E2E 轉譯重構。
  - [x] 驗證 `4_abcTS/src/synth/abc_midi_sequencer.ts` 的型別傳播：
    * `sequence(abctune: Tune, options): any[]` 成功標註 `abctune: Tune`。
    * 局部變數 `const lines: Lines[] = abctune.lines;` 成功標註 `lines: Lines[]`。
    * 局部變數 `const line: Lines = lines[i];` 成功標註 `line: Lines`。
    * 局部變數 `const staves: Staff[] = line.staff;` 成功標註 `staves: Staff[]`。
    * 局部變數 `const staff: Staff = staves[j];` 成功標註 `staff: Staff`。
    * 局部變數 `const voice: Voice[] = staff.voices[k];` 成功標註 `voice: Voice[]`。
  - [x] 於 `4_abcTS` 目錄執行 `pnpm run build:vite`，確認 Vite 打包 100% 成功，編譯結果為 **完全零錯誤** 狀態。

---

# 任務進度追蹤

**時間戳記**：2026-06-12 13:22:00

- [x] 優化 types-observed.json 型別標注套用與局部變數型別傳播
  - [x] 優化 `annotate.ts` 中 typeDB 鍵值查詢邏輯（雙重匹配）
  - [x] 擴充 `propagation.ts` 中 `runGlobalForwardPropagation` 載入與應用 typeDB 中的局部變數型別
  - [x] 修改 `code-generator.ts` 中呼叫 `runGlobalForwardPropagation` 參數
  - [x] 重新編譯建置 `pnpm run build`
  - [x] 執行 E2E 驗證對 `3_Snake` 重新重構
  - [x] 驗證 `particles.ts`, `snake.ts` 參數型別與 `audio.ts` 局部變數型別是否套用成功

---

# 任務進度追蹤

**時間戳記**：2026-06-12 13:33:00

- [x] 支援 Class 屬性 (this.xxx) 側錄與型別標注
  - [x] 修改 `babel-plugin-js2ts.ts` 對 `this.xxx = yyy` 進行插樁與側錄
  - [x] 修改 `process-file.ts` 欄位提升（4c）與補齊（4f）時讀取 typeDB 的成員屬性側錄型別
  - [x] 重新編譯 `pnpm run build`
  - [x] 執行 `node dist/cli.js run "node 3_Snake/run-test.js"` 進行 E2E 側錄
  - [x] 驗證 `types-observed.json` 中是否含有 `prop::` 側錄點
  - [x] 執行 `node dist/cli.js generate -i ./3_Snake -o ./3_SnakeTS -f` 進行重構
  - [x] 驗證 `particles.ts` 與 `snake.ts` 中的 Class 屬性型別是否正確生成

---

# 任務進度追蹤

**時間戳記**：2026-06-12 14:22:00

- [x] 支援 Callback 參數 (cb_param::x) 型別標注
  - [x] 修改 `process-file.ts`，新增「步驟 3.5」來標注 ArrowFunction 與 FunctionExpression 參數
  - [x] 修改 `annotate.ts` 的 `annotateFunction` 以支援從 typeDB 取得 cb_param 的型別
  - [x] 重新編譯 `pnpm run build`
  - [x] 執行 `node dist/cli.js generate -i ./3_Snake -o ./3_SnakeTS -f` 進行重構
  - [x] 驗證 `gameEngine.ts` 中的 `loop` 函數參數是否成功加上 `timestamp: number`

---

# 任務進度追蹤

**時間戳記**：2026-06-12 15:05:00

- [x] 支援物件字面量函數屬性 (Object Property) 執行期型別側錄與自動標註
  - [x] 修改 `src/babel-plugin-js2ts.ts` 內 `VariableDeclarator` 與 `AssignmentExpression`，移去 `.skip()` 以允許遞迴遍歷與插樁 object literal 內部 function
  - [x] 升級 `getFunctionName` (在 `src/babel-plugin-js2ts.ts` 與 `src/static-analyzer.ts`)，使其支援將 object property 與 object method 名稱解析為 `objName.propName` 格式
  - [x] 升級 `src/refactor/process-file.ts` 步驟 3.5，使其在 ts-morph AST 層面正確解析 `PropertyAssignment` 函數的名稱為 `objName.propName`
  - [x] 重新編譯並執行型別側錄 `node ../dist/cli.js run "node run-test.js"`
  - [x] 執行重構，並驗證 `parseCommon.ts` 內 `toUpperCase` 的 `str` 參數及 `snake.ts` 內 `log_keyname` 的 `keyname` 參數均成功標註為 `string`

---

# 任務進度追蹤

**時間戳記**：2026-06-12 15:38:00

- [x] 支援物件方法 (Object Method) 回傳型別 (Return Type) 推導與注入
  - [x] 修改 `src/refactor/propagation.ts` 中的 `runGlobalReturnTypePropagation`，將原本僅掃描 `VariableDeclaration` 擴展為掃描所有 `ArrowFunction` 與 `FunctionExpression`
  - [x] 對 `PropertyAssignment` 表達式引進 `objName.propName` 的命名空間解析邏輯，對齊與 `typeDB` 的鍵值命名
  - [x] 重新編譯專案 `pnpm run build`
  - [x] 重新執行重構：`node dist/cli.js generate -i ./3_Snake -o ./3_SnakeTS -f`
  - [x] 驗證 `3_SnakeTS/src/engine/parseCommon.ts` 內的 `toUpperCase` 是否成功標註為 `toUpperCase: function (str: string): string {`

---

# 任務進度追蹤

**時間戳記**：2026-07-10 14:31:00

- [x] 為純靜態前端測試專案 `5_abc010` 建立 Vite 6 型別側錄環境
  - [x] 建立 `5_abc010/package.json`
  - [x] 建立 `5_abc010/vite.config.js` 並引入 `vitePlugin`
  - [x] 安裝 Vite 6 核心套件 (`vite@6.4.3`)
- [x] 排解 `5_abc010` 目錄下 Vite 6 啟動報錯之問題
  - [x] 在 `vite.config.js` 中使用 `createRequire` 載入以 CJS 編譯的 `dist/plugins.js`，避免 Vite 6 拋出 Dynamic require 錯誤。
  - [x] 將所有 HTML 檔的過時 XHTML DOCTYPE 更改為 HTML5 `<!DOCTYPE html>`，防堵 Vite 6 HTML parse5 解析失敗。
- [x] 實作前端型別側錄自動防禦兜底（Fallback noop）
  - [x] 於 `src/plugins.ts` 中對 `vitePlugin` 加入 `__typeTracker` 兜底 inline script 注入
  - [x] 重新執行 `pnpm run build` 編譯專案
- [x] 修正 Prototype 賦值方法的參數與回傳型別注入
  - [x] 修改 `process-file.ts` 的步驟 3.5，正確解析 prototype 屬性方法的名稱
  - [x] 修改 `propagation.ts` 的 `runGlobalReturnTypePropagation` 與 `resolvePropertyAccessCallee`
  - [x] 優化 `resolvePropertyAccessCallee` 遍歷效能，消除重複掃描整檔案的效能瓶頸
  - [x] 重新執行 `pnpm run build` 編譯專案



