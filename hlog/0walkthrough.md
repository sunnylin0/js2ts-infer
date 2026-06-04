# 成果導覽與驗證報告 (`walkthrough.md`)

`js2ts-infer` 是一套全自動/半自動的 TypeScript 輔助轉換與型別推導重構工具。本導覽文件向您展示我們如何從零開始建構、實作與端到端驗證此工具。

---

## 🚀 成果亮點

1. **無侵入式雙通道插樁**：後端利用 Node.js ESM Loader / CJS Require 攔截器，前端提供 Vite/Webpack plugin。皆在記憶體中（By Babel）進行 AST 插樁，**100% 不污染硬碟原始碼**。
2. **多端型別增量合併**：支援多份側錄的 JSON 報告無損 upsert 合併，並內建**物件型別歸一化（Generalization）與融合**演算法。
3. **優雅重構與注入**：使用 `ts-morph` 自動將 CommonJS 轉為標準 ESM，並注入精準的型別與 `interface` 定義（包含索引簽章、可選屬性標註），同時完整保留原始碼的所有註解與 JSDoc。
4. **互動式審閱**：提供命令列 `review` 介面，支援跨檔案重命名介面、逐點審核 `any` 補完。

---

## 🛠 開發角色職責回顧

### 📋 [PM]
- 規劃 npm CLI 規格，實作 `init` (生成設定檔) 與 `merge` (聯集合併) 商業邏輯。
- 設定 `confidenceThreshold` (確信度門檻)，過濾噪訊並保護代碼轉換品質。

### 📐 [架構師]
- 打造了全域 `__typeTracker` 型別解析器，完美處理 Plain Object 遞迴 Shape 擷取、Promise 異步 resolve、以及 Callback 包裝代理（Reassignment Wrapped Function）。
- 設計了背景 Express/HTTP Receiver 伺服器，接收批量側錄 POST。

### 💻 [軟體工程師]
- 實作了 Babel 記憶體 AST 插樁器 (Babel plugin)，運用 `returnPath.skip()` 與 `declPath.skip()` 完美避開 AST 節點替換造成的無窮遞迴。
- 使用 `ts-morph` 撰寫 `code-generator.js`，實作強大的 CJS 語法 (require/exports) 轉 ESM (import/export) 與型別注入。
- 整合 `prompts` 完成互動式審閱終端器。

### 🧪 [測試工程師]
- 撰寫單元測試驗證合併演算法 (TC-002) 與 HTTP Receiver (TC-003)。
- 於 `2_MathCal` 前端專案進行端到端型別推導與轉換，透過 `tsc --noEmit` 成功編譯生成的 TS 代碼！

---

## 📊 MathCal 整合測試成果（E2E 驗證）

以下為我們對 `2_MathCal/modules/calculators.js` 動態側錄後，自動轉換為 `calculators.ts` 的 patch 比較：

```diff
+interface CalculateBMIReturnShape {
+  bmi: string;
+  category: string;
+  colorClass: string;
+  percent: number;
+  [key: string]: any;
+}
+
+interface CalculateAreaParamsShape {
+  length?: number;
+  width?: number;
+  side?: number;
+  base?: number;
+  height?: number;
+  radius?: number;
+  [key: string]: any;
+}

-export function calculateBMI(heightCm, weightKg) {
+export function calculateBMI(heightCm: number, weightKg: number): CalculateBMIReturnShape {

-export function calculateArea(shape, params) {
+export function calculateArea(shape: string, params: CalculateAreaParamsShape): CalculateAreaReturnShape {
```

> [!TIP]
> **優化設計：** 我們的生成器將原先多個可能引起 TS 解構錯誤的 Shape 聯集，自動融合成單一且含可選欄位的 `CalculateAreaParamsShape`，並在 interface 內自動附帶了 `[key: string]: any;` 索引簽章，讓老舊 JS 裡的動態索引操作在 TypeScript 中編譯暢行無阻！

---

## ⚙ 快速上手指令

在專案目錄下，您可使用以下指令：

```bash
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
```

---

## ⚡ 2026-06-04 更新：新增前端設定自動偵測與警告機制 (v1.1.1)

為了優化使用者體驗，我們為 `run` 命令增加了智慧偵測與保護機制：
1. **阻擋與中斷**：當執行 `run` 指令且專案為 Vite/Webpack 專案，但在專案設定檔中沒有載入插樁插件時，會立即在終端機列出錯誤並中斷程式執行，防患未然。
2. **動態空值引導**：當伺服器關閉時如果完全沒有收集到任何型別，會主動給予使用者排查指引（例如提示是否開啟瀏覽器並進行了網頁操作），引導其成功收集型別。

## ⚡ 2026-06-04 更新：規劃引入函數呼叫關係鏈 (Call Graph) 與 SVG 視覺化架構圖
- **設計宗旨**：透過進入與離開插樁、非同步與 callback 代理呼叫追蹤，自動在 `types-observed.json` 中併入專案內部模組及函數的呼叫次數（Call Count）。
- **可拖曳定位圖表**：將內嵌 D3.js 網頁，供使用者可滑鼠拖曳定位 SVG 節點，並可自由切換「檔案級依賴」或「函數級依賴」，並將靜態分析出的潛在呼叫關係以虛線方式呈現。

## ⚡ 2026-06-04 更新：支援目錄匯出與複製品質重構 (v1.1.6)
- **非侵入式匯出機制**：為 `generate` 指令新增 `--out-dir` 參數，支援將重構產物輸出至指定的全新目錄，原始專案目錄 100% 保持原樣不被破壞。
- **資源完整性**：複製過程中自動過濾大型依賴或無關目錄（如 `node_modules`），但保留 HTML、CSS 及其他配置檔案，使得輸出目錄能直接執行建置與測試。
- **導入 --in-dir 整合定位**：優化為使用 `--in-dir` 統一指定來源目錄，自動讀取其底下的 `js2ts.config.json`、`boundary-map.json` 及 `types-observed.json`，且內部型別比對之相對路徑以此目錄為基準，完全消除了跨目錄執行時的鍵值不匹配問題。
- **E2E 驗證結果**：於 `abcTest` 中執行 `node ../abc_js2ts/dist/cli.js generate --in-dir 3_Snake --out-dir 3_SnakeTS --force`，成功產生 `3_SnakeTS` 目錄。於該目錄下執行 `pnpm install` 與 `npx tsc --noEmit`，型別與編譯結果 100% 通過（無任何錯誤），且原始 `3_Snake` 目錄完全保留。

## ⚡ 2026-06-04 更新：目錄複製時避免覆寫已有檔案 (v1.1.7)
- **非覆蓋式增量複製**：在複製檔案至 `outDir` 時，若同名檔案已存在於目標目錄中，工具會自動跳過複製，確保使用者在目標目錄中所做的修改（如自訂 package.json 的 script、HTML 引入等）不會被回寫覆蓋。
- **轉換後的 TS 檔照常覆寫**：轉換產生的全新 `*.ts` 檔案不受此複寫保護影響，會直接寫入並覆蓋，確保型別注入的即時更新。
- **E2E 驗證成功**：在 `3_SnakeTS/package.json` 中手動加入測試 description，重新執行轉換指令，確認 package.json 未被覆蓋，且 `src/` 底下的所有 `*.ts` 檔案仍成功被轉換並覆寫更新。

