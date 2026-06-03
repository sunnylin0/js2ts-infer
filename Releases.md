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

