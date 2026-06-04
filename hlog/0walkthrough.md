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

