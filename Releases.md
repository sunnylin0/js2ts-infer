# Releases 大綱

## [2026-06-04] v1.0.0 - js2ts-infer 工具首版發行
- **專案基礎配置**：完成 npm/pnpm 專案初始化，並安裝 `ts-morph`、`@babel/core`、`commander` 等核心依赖。
- **靜態與動態雙通道分析**：
  - 實作 `init` 指令，建立 `js2ts.config.json` 預設範本。
  - 實作 `scan` 指令，遍歷 AST 建立 Class 地圖與 Exports 邊界。
  - 實作 `run` 指令，於背景啟動型別回收 HTTP 伺服器，自動掛載 CommonJS 攔截器與 ESM Loader，進行無侵入式執行期型別側錄。
- **型別合併與歸一**：
  - 實作 `merge` 指令，合併多端 observed types。
  - 研發**物件 Shape 融合與歸一化**演算法，防範 TypeScript 屬性解構編譯報錯。
- **重構與型別注入**：
  - 實作 `generate` 指令，基於 `ts-morph` 精確注入 TypeScript 介面、索引簽章與參數型別，並將頂層 CommonJS (`require`) 重構為標準 ESM (`import/export`)。
  - 實作 `review` 指令，提供終端互動式 UI 讓使用者補完 `any` 及重命名介面。
- **重大問題修正**：
  - 解決 Windows 環境下 `NODE_OPTIONS` 路徑逸出與大小寫磁碟代號匹配問題。
  - 修正 Babel AST 替換造成的遍歷無窮遞迴（引入 `returnPath.skip()` 解決）。
- **進階 E2E 驗證**：
  - 在 `1_todo` 前端專案中執行完整的 scan、run 側錄與 generate 轉換。
  - **Chrome 瀏覽器側錄驗證**：成功在 `run` 命令中背景啟動 9002 型別伺服器與 Vite 開發伺服器，利用 Puppeteer 控制 Chrome 瀏覽器自動對網頁待辦事項進行新增、刪除、狀態切換操作，完整驗證了前端 Vite 插件於 unload 時將型別資料 POST 傳回的運作流。
  - 成功克服隱式型別轉換導致的 `Array<[object Object]>` 髒資料巨坑，設計了雙重防護替換與 Array 元素物件格式化器，將其歸一為合法的 `Array<{ [key: string]: any }>`，達成 100% TS 語法無暇生成。
## [2026-06-04] v1.1.0 - CLI 工具全面 TypeScript 重構
- **CLI 工具與指令 TS 化**：
  - 將命令列入口 `cli.js`、所有 6 個子命令實作、以及擴充插件 `plugins.js` 全面重構為 TypeScript。
  - 將 CJS 插樁 Hook `loader-hook.js` 與 ESM 插樁 Hook `loader-hook-esm.mjs` 重構為 TypeScript，為專案開發期提供強型別約束。
- **編譯配置與工程改進**：
  - 建立雙 TS 編譯架構，使用 `tsconfig.json` 編譯 CommonJS 主程式至 `dist/`，使用 `tsconfig.esm.json` 將 ESM 載入器編譯至獨立的 `dist-esm/` 目錄，防範編譯產物因依賴關係互相覆蓋。
  - 實作 `build-post.js` 自動化後置處理：將 `dist-esm/loader-hook-esm.js` 複製為 `dist/loader-hook-esm.mjs`，產出符合 Node.js 加載規範的 ESM Hook，並自動清理臨時編譯目錄 `dist-esm/`。
- **Node.js 新版本執行期相容性處理**：
  - 實作 `dist/register.js` 支援 Node.js >= 20.6.0 的 `module.register` 標準模組註冊 API。
  - 於 `run` 命令中新增環境偵測，若 Node.js 版本符合，改用 `--import` 機制載入取代舊的 `--experimental-loader`。
  - 針對 Node.js >= 22 預設開啟 `require(esm)` 導致的 CJS/ESM 互操作 `resolveSync` 崩潰問題，於執行時動態為 Node.js >= 22 注入 `--no-experimental-require-module` 啟動旗標，徹底繞過 Node.js 同步解析限制，保障工具高可用性。
- **程式碼清理**：
  - 清除 `src/` 與 `src/commands/` 下所有舊的 `.js` 與 `.mjs` 原始碼檔案，保持專案程式庫的整潔與純 TypeScript 結構。

## [2026-06-04] v1.1.1 - 新增前端設定自動偵測與警告機制
- **前端配置靜態偵測**：於 `run` 指令啟動前自動掃描 `package.json`，若為 Vite/Webpack 專案但設定檔未啟用 `vitePlugin` 或 `webpackLoader`，會主動印出錯誤並中斷程式執行。
- **動態結果查驗與提示**：在指令執行結束且背景伺服器關閉時，若偵測到產出的型別紀錄 (`types-observed.json`) 為空，則會為前端專案提供具體的排查建議，防止因未啟用插樁導致側錄落空。

## [2026-06-04] v1.1.2 - 新增 Class 屬性自動宣告與注入機制
- **自動化成員屬性宣告**：在型別生成階段，透過靜態分析掃描 Class 內部所有以 `this.xxx` 賦值的動態成員，自動於 TS 類別中補上成員屬性宣告，排除轉換後出現「屬性未定義」之 TypeScript 編譯錯誤，並自動過濾 `constructor` 關鍵字，且宣告位置強制置於 Class 最頂部（第一順位）。
- **強大 Parser 切換與 Safe Fallback**：將原始碼一律改以預設 TS Parser 解析載入，並實作 safeAddProperty 降級插入文字機制，繞過 ts-morph 在特殊類別結構上的插入崩潰，保障 100% 成功注入。

## [2026-06-04] v1.1.3 - 實作構造函式無依賴屬性置頂初始化重構 (Class Fields Codemod)
- **Class Fields 動態搬移**：在型別生成階段，自動識別 `constructor` 中不依賴參數與內部局部變數的 `this.xxx = yyy` 賦值語句，將其與其 Leading Comments (註解) 一起安全地搬移至 Class 頂部作為屬性初始值，並於 `constructor` 內部刪除，使 TS 類別更加精煉與現代化。
- **防止 Node 失效與併發安全**：採用「唯讀收集與修改分離」雙階段設計，並一次性呼叫 `insertProperties` 批量寫入屬性，徹底解決 `ts-morph` 頻繁修改 AST 導致的 `Attempted to get information from a node that was removed or forgotten` 崩潰問題。

## [2026-06-04] v1.1.4 - 支援 Class 建構函式參數型別注入
- **Class 建構函式型別標註**：修復了重構工具在寫入型別時遺漏對 `constructor` 進行標註的問題。在 AST 處理流程中加入對 `cls.getConstructors()` 的遍歷並調用 `annotateFunction`，使側錄到的建構函式參數型別（例如 `particles.ts` 中的 `x: number, y: number, color: string`）能精確注入至生成的 TypeScript 檔案中。

## [2026-06-04] v1.1.5 - 專案地圖初始化
- **初始化專案地圖**：依據 `/init` 指令，執行靜態掃描分析並生成 `agent.md`。記錄核心技術棧 (Node.js/TypeScript)、專案架構目錄樹、開發規範與 AI 協作備忘錄。

## [2026-06-04] v1.1.6 - 支援目錄匯出與非侵入式重構
- **目錄匯出與非侵入式轉換**：新增 `generate` 指令的 `-i, --in-dir` 與 `-o, --out-dir` 參數，允許將轉換後的 TS 專案匯出至指定目錄，自動讀取來源目錄下之配置與側錄檔案，完整複製 HTML、CSS 等資源檔，並過濾掉 `node_modules` 等非必要檔案，同時保證原始 JavaScript 目錄不受修改與污染，且解決跨目錄執行時的相對路徑型別對齊問題。

## [2026-06-04] v1.1.7 - 目錄複製非覆寫與轉換 TS 覆寫機制
- **目錄複製防覆蓋保護**：優化 `generate` 的 `outDir` 複製邏輯，若目標目錄已存在同名檔案則拒絕覆蓋，保護自訂設定或修改。
- **轉換後的 TS 覆蓋**：全新生成的 `*.ts` 檔案不受防覆蓋保護限制，照常直接寫入並覆蓋，確保型別注入內容即時更新。
