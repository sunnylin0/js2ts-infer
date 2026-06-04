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

