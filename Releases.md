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

