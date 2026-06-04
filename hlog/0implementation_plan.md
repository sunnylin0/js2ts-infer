# Implementation Plan - JS → TS 執行時期型別輔助轉換工具 (`js2ts-infer`)

本計畫規劃開發 `js2ts-infer` 命令列工具，透過**靜態分析**與**執行期動態代理/插樁**雙通道混合模式，協助將 JavaScript 專案重構為 TypeScript。

## User Review Required

> [!IMPORTANT]
> **1. 前端與後端的無侵入式插樁設計**
> - **後端 (Node.js)**：透過覆寫 `module.constructor.prototype.require` (CJS) 以及實作 Node.js ESM Loader Hook (ESM)，在記憶體中動態載入 Proxy 攔截器，不需要修改硬碟檔案。
> - **前端 (瀏覽器)**：提供 **Vite Plugin** 與 **Webpack Loader**，在開發伺服器 (Dev Server) 啟動時於記憶體中進行 AST 插樁，並透過背景 HTTP Receiver 收集型別。
>
> **2. CommonJS 到 ESM 的自動轉換**
> - 在 `generate` 階段，除了注入型別，還會自動將 CommonJS 語法 (`require`/`module.exports`) 重構為 ESM 語法 (`import`/`export`)。

## Open Questions

> [!NOTE]
> 目前設計無懸而未決的重大問題，將直接進入開發。

---

## Proposed Changes

### [js2ts-infer 核心工具]

#### [NEW] [package.json](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/package.json)
初始化根目錄專案，設定為 CLI 工具，並安裝必要依賴：
- `commander` (CLI 框架)
- `@babel/core`, `@babel/parser`, `@babel/traverse`, `@babel/generator` (AST 靜態分析與插樁)
- `ts-morph` (TypeScript 程式碼生成與注入)
- `prompts` (互動式 review 介面)
- `chalk`, `ora` (終端美化)
- `diff` (Dry run diff 輸出)
- `express` 或 `polka` (背景 HTTP Receiver 伺服器)

#### [NEW] [cli.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/cli.js)
實作 6 個 CLI 指令的入口：
1. `init`
2. `scan`
3. `run <command>`
4. `merge <files...>`
5. `generate`
6. `review`

#### [NEW] [js2ts.config.json](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/templates/js2ts.config.json)
預設設定檔範本，包含 `include`、`exclude`、`trackerPort`、`maxDepth`、`confidenceThreshold` 等參數。

#### [NEW] [static-analyzer.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/static-analyzer.js)
- 靜態掃描專案檔案，識別 Class 定義與 Export 邊界。
- 產生並輸出 `boundary-map.json`。

#### [NEW] [tracker-server.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/tracker-server.js)
- 啟動背景 HTTP Server，接收來自 Node.js 進程與瀏覽器端 POST 的型別資料。
- 露出 `GET /tracker.js` 供前端瀏覽器載入。
- 將收集到的資料寫入 `types-observed.json`。

#### [NEW] [tracker-client.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/tracker-client.js)
- 注入到執行期環境（Node.js 全域或瀏覽器 `window`）的 `globalThis.__typeTracker` 實作。
- 包含遞迴解析型別的 `serializeType` 邏輯。
- 實作 Callback 代理包裝（Wrapped Function）與 Promise resolve 追蹤。
- 緩衝型別資料並定時/在結束前 POST 回傳至 HTTP Server。

#### [NEW] [loader-hook.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/loader-hook.js)
- **CommonJS Hook**：攔截 `require`，對屬於邊界的 exports 套用 `Proxy`。
- **ESM Loader Hook**：Node.js ESM 載入攔截，對邊界導出進行代理包裝。

#### [NEW] [plugins.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/plugins.js)
- 實作 **Vite Plugin** 與 **Webpack Loader**，供前端專案於開發期進行記憶體中的 AST 插樁。

#### [NEW] [type-merger.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/type-merger.js)
- 實作多個 `types-observed.json` 的增量合併 (Upsert) 邏輯。
- 處理 Union Types、Nullable、Optional 與物件 Shape 合併。

#### [NEW] [code-generator.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.js)
- 讀取原始 JS 檔案，將其複製為 TS 檔案。
- 將 CommonJS 語法重構為 ESM。
- 使用 `ts-morph` 精確注入型別標註，並在頂部產生對應的 `interface` 與 `import type`。
- 保留所有 JSDoc 與既有註解。
- 實作 Git 安全檢查與 `--dry-run` 輸出。

#### [NEW] [interactor.js](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/interactor.js)
- 實作互動式審閱介面，處理剩餘 `any` 補完與 `interface` 重新命名。

---

## Verification Plan

### Automated Tests
- 撰寫測試腳本，針對 `type-merger.js` 驗證 `observedTypes` 聯集與物件 Shape 合併（TC-002）。
- 模擬發送 POST 請求驗證背景 `tracker-server.js` 接收並無損寫入（TC-003）。
- 使用 `git` 測試 `generate` 的安全防護與 `--dry-run` 輸出（TC-004, TC-005）。

### Manual Verification
- 於 `1_todo`、`2_MathCal` 或 `3_Snake` 測試專案上執行：
  1. `npx js2ts-infer init` 驗證設定檔生成（TC-001）。
  2. `npx js2ts-infer scan` 生成 `boundary-map.json`。
  3. `npx js2ts-infer run <test-command>` 側錄型別的入口。
      ex: `npx js2ts-infer run "node 2_MathCal/main.js"`
      # 或使用 pnpm
      ex: `npx js2ts-infer run "pnpm dev"`
  4. `npx js2ts-infer merge types-observed.json --out merged-types.json` 合併多端型別。
  5. `npx js2ts-infer generate` 生成 TS 檔案，並以 `tsc --noEmit` 驗證其可編譯性。
  6. `npx js2ts-infer review` 審閱剩餘的 `any`。


# 1. 於目錄初始化設定檔
node ../src/cli.js init

# 2. 靜態分析 Export 邊界，產生 boundary-map.json
node ../src/cli.js scan

# 3. 背景啟動伺服器，執行測試並側錄型別，生成 types-observed.json
node ../src/cli.js run "node test-run.mjs"

# 4. 合併多端型別
node ../src/cli.js merge types-observed.json --out merged-types.json

# 5. 型別注入與重構 (.js -> .ts / CJS -> ESM)
node ../src/cli.js generate --force

# 6. 開啟終端互動式 review 補完與介面重新命名
node ../src/cli.js review

---

## 偵測未配置前端插件之設計 (新增)

為了解決前端專案 (Vite / Webpack) 忘記配置 `vitePlugin` 或 `webpackLoader` 導致側錄落空的問題，於 `run` 指令啟動前與結束後新增以下檢查機制：

### 1. 靜態設定檔掃描
在 `js2ts-infer run` 啟動前，若 `package.json` 中宣告有 `vite` 或 `webpack` 依賴：
- 檢查根目錄是否包含 `vite.config.*` 或 `webpack.config.*`。
- 若不存在，或檔案內容中未包含 `vitePlugin`、`webpackLoader` 等關鍵字，即印出顯眼的錯誤並中斷程式執行。

### 2. 運行時空資料警告
若指令執行結束時產出的 `types-observed.json` 為空，且偵測到前端框架，則提示使用者確認是否正確開啟網頁進行操作，以利觸發側錄。

---

## Class 屬性自動宣告與置頂重構機制 (新增)

為了解決從 JavaScript 轉 TypeScript 後，Class 成員屬性（Member Properties）未宣告導致的編譯錯誤，新增以下重構機制：

### 1. 成員屬性宣告置頂
- **問題**：在 JavaScript 中，可直接在 `constructor` 內使用 `this.xxx = yyy` 來動態建立變數；但在 TypeScript 中，Class 的成員屬性必須先在 Class 頂層進行顯式宣告，否則編譯器會報錯。
- **解決方案**：在型別生成階段，透過靜態分析掃描 Class 內部所有以 `this.xxx` 賦值的動態成員，自動於 TS 類別中最頂部（第一順位）補上成員屬性宣告，並自動過濾 `constructor` 關鍵字，以防出現「屬性未定義」之 TypeScript 編譯錯誤。
- **Safe Fallback 降級處理**：實作 `safeAddProperty` 機制，若 AST 修改失敗，則改用 safe 降級插入文字機制，繞過 ts-morph 在特殊類別結構上的插入崩潰，保障 100% 成功注入。

### 2. 構造函式無依賴屬性置頂初始化重構 (Class Fields Codemod)
- **Class Fields 動態搬移**：自動識別 `constructor` 中不依賴參數與內部局部變數的 `this.xxx = yyy` 賦值語句，將其與 Leading Comments (註解) 一起安全地搬移至 Class 頂部作為屬性初始值，並於 `constructor` 內部刪除，使 TS 類別更加精煉。
- **JSDoc 升級**：在搬移註解時，自動將關聯的 `//` 或 `/*` 註解轉換為標準 JSDoc 格式附加於新產生的 Class 屬性上。

### 3. Class 建構函式參數型別注入
- **問題**：在型別生成時，原工具僅對成員方法進行遍歷，忽略了 `constructor` 本身，導致 `types-observed.json` 中已收集到的構造函式參數型別（如 `x: number, y: number, color: string`）無法注入。
- **解決方案**：在 `generate` 階段，補上對 `cls.getConstructors()` 的遍歷與 `annotateFunction` 呼叫，使建構函式參數也能無縫標註型別。


---

### [2026-06-04 14:50] 支援目錄匯出與複製品質重構計畫

為了支援將 JavaScript 專案轉換並匯出至全新目錄（例如從 `./3_Snake/` 匯出至 `./3_SnakeTS/`），避免直接修改或污染原本的開發目錄，我們規劃為 `generate` 指令擴充 `--out-dir` 參數。

#### 1. 需求與行為設計
- **參數擴充**：於 `generate` 子指令新增 `-o, --out-dir <dir>` 選項。
- **目錄複製（無侵入式匯出）**：
  - 當指定 `--out-dir` 時，在非 Dry Run 模式下，會先將整個來源目錄（即 `js2ts.config.json` 所在的父目錄）遞迴複製至指定的目標目錄。
  - 複製時自動過濾 `node_modules`、`.git`、`dist`、`dist-esm`、`temp` 等無關目錄，並過濾掉目標目錄本身（若目標目錄位於來源目錄內部）。
- **轉換與寫入**：
  - 讀取來源目錄中的 JavaScript 檔案，以 AST 分析與型別推導生成 TypeScript 內容。
  - 將轉換後的 `.ts` 內容寫入至目標目錄對應的相對路徑中。
  - 刪除目標目錄中對應的被複製 `.js` 檔案，確保目標目錄中只留下轉換後的 `.ts` 檔案，不殘留 `.js` 檔。
  - 來源目錄中的原始 `.js` 檔案將完整保留，不受影響。

#### 2. 受影響之檔案與修改內容

##### [MODIFY] [cli.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/cli.ts)
- 在 `generate` 指令下新增：
  ```typescript
  .option('-o, --out-dir <dir>', '將重構後的結果匯出至指定目錄，不修改原始目錄')
  ```

##### [MODIFY] [commands/generate.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/commands/generate.ts)
- 更新 `GenerateOptions` 介面，新增 `outDir?: string;` 欄位。

##### [MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- 在 `runGeneration` 中，新增 `srcDir` 的解析（以 `path.dirname(configPath)` 為基準）。
- 實作遞迴複製來源目錄至 `outDir` 的機制（過濾無關目錄）。
- 於遍歷檔案寫入與刪除邏輯中，若指定了 `outDir`，則寫入至 `outDir` 底下對應的 `.ts`，並刪除 `outDir` 底下的 `.js`，保留來源目錄的原始檔案。

#### 3. 驗證與測試計畫
- **功能驗證**：
  - 於 `c:\Users\ESAO_NB27\Desktop\abcTest` 執行：
    ```bash
    node ../abc_js2ts/dist/cli.js generate --config 3_Snake/js2ts.config.json --out-dir 3_SnakeTS --force
    ```
  - 確認 `3_SnakeTS` 目錄被建立，其中包含所有的 HTML、CSS、Assets 資源，且 `src/` 下的原 `.js` 檔案皆被正確重構為 `.ts`，且原 `3_Snake` 目錄下的 `.js` 檔案未被刪除。

---

### [2026-06-04 14:58] 修正計畫：引入 `--in-dir` 參數以支援模組化目錄重構

配合您的建議，將原本使用 `--config` 定位來源目錄的設計，改為直接提供 `--in-dir` 參數。

#### 1. 調整後的行為與規格
- **指令格式**：
  ```bash
  npx js2ts-infer generate --in-dir ./3_Snake --out-dir ./3_SnakeTS
  ```
- **目錄定位與檔案讀取**：
  - `inDir` 預設為 `process.cwd()`。
  - 工具會自動讀取 `inDir` 底下的 `js2ts.config.json`（設定檔）、`boundary-map.json`（邊界圖）與 `types-observed.json`（型別側錄檔）。
  - 對於前端 Vite 或 Webpack 設定檔的掃描，亦會以 `inDir` 目錄為基準。
  - 型別資料庫的相對路徑比對鍵值（如 `src/state/states.js`），其 `relPath` 的計算基準將由 `process.cwd()` 改為 `inDir`，以確保從外部目錄執行時能正確對齊型別。
- **目錄複製與輸出**：
  - 若指定 `--out-dir`，會將 `inDir` 的內容（過濾 `node_modules` 等）複製到 `outDir`。
  - 將轉換後的 `.ts` 寫入 `outDir`，並刪除 `outDir` 底下的 `.js` 檔案。

#### 2. 受影響之檔案與修改內容

##### [MODIFY] [cli.ts](file:///c:/Users/ESAO_NB27\Desktop/abc_js2ts/src/cli.ts)
- 在 `generate` 指令下新增：
  ```typescript
  .option('-i, --in-dir <dir>', '輸入/來源專案目錄路徑', '...')
  ```

##### [MODIFY] [commands/generate.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/commands/generate.ts)
- 更新 `GenerateOptions` 介面，新增 `inDir?: string;` 欄位。

##### [MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- 調整 `processFileRefactoring` 簽章，新增 `inDir` 參數，使內部 `relPath` 計算為 `path.relative(inDir, filePath)`。
- 於 `runGeneration` 中，根據 `options.inDir` 決定 `inDir` 絕對路徑，並調整設定檔、型別側錄檔、以及 glob 搜尋的 `cwd` 基準。

---

### [2026-06-04 15:20] 修正計畫：目錄複製時避免覆寫已有檔案

為避免重構輸出時不慎覆寫目標目錄中已被使用者修改的既有檔案，我們調整了目錄複製與轉換的寫入機制。

#### 1. 調整後的行為與規格
- **複寫保護**：
  - 複製來源目錄 `inDir` 至目標目錄 `outDir` 時，若目標路徑已存在同名檔案，則**跳過複製**，以保護目標目錄中的自訂修改。
- **轉換覆蓋**：
  - 由 AST 轉換生成的全新 `*.ts` 檔案不受複寫保護限制，寫入時會**直接覆蓋**目標目錄中的對應 `*.ts` 檔案，確保重構結果能即時更新。
- **原始檔案安全**：
  - 原始專案目錄 `inDir` 中的檔案完全不受影響。

#### 2. 受影響之檔案與修改內容

##### [MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- 調整 `fs.cpSync` 複製選項中的 `filter` 方法。
- 若目標路徑 `destPath` 已存在，且來源路徑 `srcPath` 為檔案，則回傳 `false` 拒絕複製；目錄本身則繼續遞迴掃描，實現「增量且無害複製」。

---

### [2026-06-04 15:40] 修正計畫：移除 `--no-experimental-require-module` 啟動旗標以支援 Vite 8

#### 1. 調整後的行為與規格
- 針對 Node.js >= 22，不再主動於環境變數 `NODE_OPTIONS` 中注入 `--no-experimental-require-module`。
- 這可使 Node.js 能正常利用原生的 `require(esm)` 機制，在 Vite 8 啟動並載入舊版 CommonJS 設定檔或混和模組時，成功 `require()` 其所依賴的 ES 模組，避免拋出 `ERR_REQUIRE_ESM` 錯誤。

#### 2. 受影響之檔案與修改內容

##### [MODIFY] [src/commands/run.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/commands/run.ts)
- 刪除對 `major >= 22` 注入 `--no-experimental-require-module` 的邏輯程式碼。

---

### [2026-06-04 15:55] 修正計畫：加強建構函式屬性搬移 (Class Fields Codemod) 的安全過濾機制

針對重構 `4_abc662` 時產生的類別宣告語法衝突，加強屬性搬移時的安全分析。

#### 1. 調整後的行為與規格
- **避免同名衝突**：
  - 若 `this.xxx` 的屬性名稱與 Class 中已定義的 Method 相同（例如 `this.play = this.play.bind(this)`），則**不進行搬移**，防止產生重覆宣告的 TS 編譯與解析錯誤。
- **避免重複宣告**：
  - 若構造函式中對 `this.xxx` 進行了多次賦值（例如先 initialized 為 `null`，之後再 assigned 為其他值），則**僅搬移第一次賦值宣告**，其餘留在 constructor 內部。
- **避免依賴未初始化實例狀態**：
  - 若右側表達式 `yyy` 含有 `this.`（如 `this.abcjsParams.clickListener`），由於這類賦值往往依賴建構函式執行期間的實例動態狀態（在 class properties 階段尚未建立），因此**不進行搬移**。

#### 2. 受影響之檔案與修改內容

##### [MODIFY] [src/code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- 在 `runGeneration` 內部的第一階段「唯讀收集」邏輯中，新增 `classMethods`、`collectedPropNames` 的過濾器，並偵測 `rightText.includes('this.')`。符合上述任一條件即跳過搬移。


---

### [2026-06-04 14:35] 函數呼叫關係鏈 (Call Graph) 側錄與視覺化實作計畫

此計畫旨在為 `js2ts-infer` 擴充動態與靜態呼叫關係收集器，並整合至 `types-observed.json` 中，最後提供一個內嵌的可互動拖曳 HTML/SVG 架構圖檢視工具。

#### 1. 需求要點與架構設計
- **連線粒度**：支援「檔案級依賴」與「函數級依賴」雙重模式，在 HTML 視覺化介面中可動態勾選切換。
- **非同步與間接呼叫追蹤**：於 Runtime Tracker 中，利用全域 Mock `callStack` 追蹤呼叫來源。當函數被包裝成 callback 傳遞時，綁定當下的 caller 作為 `parentCaller`。當非同步 callback 觸發執行時，將 `parentCaller` 壓入 context 中，保證非同步與間接呼叫能正確追蹤到其發起函數。
- **過濾機制**：僅記錄專案內部的模組與函數呼叫關係，自動過濾掉 `node_modules` 與瀏覽器原生內建 API（如 `setTimeout`、`document` 等）。
- **頻率統計**：累加並記錄各個呼叫線路的執行次數（`count`）。
- **靜態分析補足（潛在關係）**：結合靜態 AST 分析（掃描 `import`/`require` 導入的變數與呼叫路徑），找出「有定義但側錄期間未被執行」的潛在關係連線，在視覺化圖表中使用虛線呈現。
- **資料儲存**：呼叫關係與現有的 `types-observed.json` 進行欄位合併。
- **SVG 視覺化流程圖**：建立一個內嵌 HTML 頁面，使用 D3.js 繪製可互動拖曳的 SVG 力導向圖，提供搜尋、節點拖曳固定、依賴模式切換、以及匯出 SVG 檔案之功能。

#### 2. 受影響之檔案與修改內容

##### [MODIFY] [babel-plugin-js2ts.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/babel-plugin-js2ts.ts)
- **進入與離開插樁**：
  - 在進入每一個 Function 區塊最前端，插入 `globalThis.__typeTracker.enter(funcId)`。
  - 在函數區塊的尾端，或者在 `ReturnStatement` 之前，插入對 `globalThis.__typeTracker.exit(funcId)` 的呼叫（或在 Runtime wrapper 中統一處理 exit 邏輯）。

##### [MODIFY] [tracker-client.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/tracker-client.ts)
- **全域呼叫棧管理**：
  - 新增全域 `callStack` 陣列。
  - 實作 `__typeTracker.enter(funcId)`：
    - 取得 `callStack` 頂部的 caller。
    - 若 caller 存在且為專案內部路徑，記錄一筆從 `caller` -> `funcId` 的呼叫次數，寫入 `clientDB`。
    - 將 `funcId` 壓入 `callStack`。
  - 實作 `__typeTracker.exit(funcId)`：
    - 從 `callStack` 中安全彈出 `funcId`。
- **非同步與 Callback 綁定**：
  - 修正 `wrapFunction(trackerId, originalFn)`，在 wrap 函數時，透過閉包（Closure）捕捉當前 `callStack` 的頂部函數 `parentCaller`。
  - 在 `wrappedFn` 執行時，先將 `parentCaller` 壓入 `callStack`，再執行 `originalFn`，執行完畢後 pop 移出，使 Callback 內部引發的後續呼叫能追蹤到非同步起點。

##### [MODIFY] [static-analyzer.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/static-analyzer.ts)
- **靜態依賴掃描**：
  - 新增 `analyzeStaticCalls(ast, relativePath)` 方法，分析 `import` 與 `require` 關係。
  - 掃描所有 `CallExpression`。若呼叫的對象為導入模組或其屬性，記錄一筆潛在呼叫關係，標記為 `{ count: 0, isDynamic: false }`。
  - 將靜態掃描結果輸出並與動態側錄資料在 `merge` / `generate` 階段進行融合。

##### [MODIFY] [tracker-server.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/tracker-server.ts)
- **JSON 資料合併儲存**：
  - 在型別資料庫中新增 `"__callGraph"` 特殊鍵值，儲存扁平化的呼叫網絡對照表，格式如下：
    ```json
    "__callGraph": {
      "src/fileA.js::fnX->src/fileB.js::fnY": {
        "count": 12,
        "isDynamic": true
      }
    }
    ```
  - 當收到 POST 的型別資料時，進行累加合併。

##### [NEW] [visualizer.ts / visualizer.html](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/visualizer.ts)
- 實作內建視覺化檢視工具：
  - 新增指令 `js2ts-infer visual`，啟動本地伺服器並在瀏覽器中開啟 `visualizer.html`。
  - 使用 D3.js 力導向圖繪製節點（檔案與函數）與連線（實線代表動態呼叫，虛線代表靜態潛在呼叫，粗細代表呼叫次數）。
  - 提供 Drag 節點手動定位功能，被 Drag 的節點會固定（`fx`, `fy`）防止繼續漂移。
  - 提供檔案層級與函數層級的切換勾選框。
  - 提供 SVG 匯出按鈕。

#### 3. 驗證與測試計畫
- **E2E 驗證**：在 `3_Snake` 專案中啟動 `js2ts-infer run`，手動玩蛇吃幾顆食物（觸發 audio、particle 呼叫），關閉後確認 `types-observed.json` 中含有正確的 `"__callGraph"` 資料。
- **UI 測試**：執行 `js2ts-infer visual`，在網頁上拖曳粒子爆炸與遊戲引擎節點，確認能夠自由固定位置，且切換至檔案模式後，架構圖會簡化為模組間的連線。
