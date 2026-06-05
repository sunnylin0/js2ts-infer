# 🚀 Project Blueprint: js2ts-infer

## 1. 核心技術棧 (Multi-Stack Details)
- **Runtime**: Node.js (>= 18.0.0)
- **Languages**: TypeScript, JavaScript
- **Databases**: 無偵測到資料庫依賴

## 2. 專案架構 (Architecture)
```text
c:\Users\sunny\Desktop\abc_js2ts
├── dist/                          # 編譯後的 CommonJS 與 ESM 產物 (*.js, *.d.ts)
├── history/                       # 歷史變更日誌與進度追蹤 (Releases.md, task_log.md 等)
├── src/                           # 核心 TypeScript 原始碼
│   ├── commands/                  # CLI 子指令實作 (init, scan, run, merge, generate, review, visualize)
│   │   ├── generate.ts            # 重構程式碼生成入口
│   │   ├── init.ts                # 初始化設定檔指令
│   │   ├── merge.ts               # 合併側錄型別資料指令
│   │   ├── review.ts              # 互動式 any 審閱
│   │   ├── run.ts                 # 執行期側錄啟動指令
│   │   ├── scan.ts                # 靜態依賴關係掃描
│   │   └── visualize.ts           # 關係圖視覺化伺服器
│   ├── ast-refactorer.ts          # AST 轉換、型別正反向傳播與 Class 屬性/方法清洗
│   ├── babel-plugin-js2ts.ts      # Babel AST 插樁插件
│   ├── cli.ts                     # CLI 入口定義
│   ├── code-generator.ts          # ts-morph 型別注入與重構生成控制器
│   ├── feedback-loop.ts           # TSC 編譯錯誤反饋與 AI 自我修正 (Gemini API)
│   ├── interactor.ts              # 互動式型別審閱核心
│   ├── loader-hook-esm.ts         # ESM 執行期插樁攔截器
│   ├── loader-hook.ts             # CommonJS 執行期插樁攔截器
│   ├── plugins.ts                 # Vite 與 Webpack 插件/載入器接口
│   ├── static-analyzer.ts         # 靜態 Exports、Imports 與 Class 依賴掃描器
│   ├── templates/                 # 視覺化 HTML 範本 (D3.js Neon Aesthetics)
│   │   └── visualizer.html
│   ├── tracker-client.ts          # 注入執行期的全域 __typeTracker 側錄端程式
│   ├── tracker-server.ts          # 背景型別收集 Express/HTTP 伺服器
│   └── type-merger.ts             # 側錄型別資料無損合併器
├── package.json                   # 專案配置與 npm 依賴
├── pnpm-lock.yaml                 # pnpm 鎖定檔
├── tsconfig.json                  # CommonJS 編譯配置
├── tsconfig.esm.json              # ESM 編譯配置
├── build-post.js                  # 後置處理腳本，複製/重命名 ESM hook 並清理暫存目錄
└── NOTES.md                       # 開發筆記

測試用專案
1_todo/ 
2_MathCal/
3_Snake/
3_SnakeTS/			# 測試中的 3_Snake 轉 TS 版本
4_abc662/ 			
4_abcTS/ 			# 測試中的 4_abc662 轉 TS 版本
AI_abcTS/			# Gemini AI 生成的 abcTS 版本
```

## 3.開發規範與禁忌 (Project-Specific Rules)
Legacy Support: 本專案為純 Node.js / TypeScript 開發，無 .aspx 等 Legacy 規範。

Type Safety: TS 專案需遵循嚴格型別檢查。修改 `src/` 程式碼時，請確保無 TypeScript 編譯與型別錯誤。

SQL Standards: 無資料庫語法規範。

## 4. 關鍵入口與指令
Node.js (pnpm):
- 建置專案: `pnpm run build`
- 執行測試: `pnpm run test`
- 核心執行入口: `dist/cli.js`

## 5. AI 協作備忘錄 (Context for Agent)
- **Babel AST 遞迴防範**：修改 `src/babel-plugin-js2ts.ts` 時，務必妥善使用 `returnPath.skip()` 與 `declPath.skip()`，避免節點替換導致無窮遞迴。
- **Node.js ESM 載入器相容性**：ESM Hook 需支援 Node.js 不同版本的加載規格（如 >= 20.6.0 的 `module.register` 與舊版的 `--experimental-loader`）。`build-post.js` 會將 `dist-esm/loader-hook-esm.js` 重新命名並複製為符合規格的 `dist/loader-hook-esm.mjs`。
- **Class 屬性重構與 Class Fields Codemod**：
  - 型別生成時必須確保所有的 `this.xxx` 動態成員均在 Class 最頂部（第一順位）宣告，以防止 TypeScript 編譯錯誤。
  - `constructor` 內無依賴的 `this.xxx = yyy` 應安全移至 Class 頂部並升級註解至 JSDoc。
  - 對 `ts-morph` 進行 AST 修改時，應採用「唯讀收集與修改分離」雙階段設計以保障併發安全性，防止 AST 節點失效崩潰。
- **型別正反向傳播與寬化 (Literal Widening)**：
  - 當利用推導型別或動態側錄進行標註時，必須呼叫 `widenTypeName` 函數將字面量型別（例如 `0`, `true`, `'foo'`) 寬化為基礎型別（`number`, `boolean`, `string`），避免型別過度收窄。
- **宣告檔對齊與 Interface 優先策略**：
  - 優先尋找載入的同名 `*.d.ts` Interface 進行屬性與方法簽章型別對齊，若宣告檔無定義時，才使用 AST 推導，最後再以 `typeDB` 側錄 Shape 兜底，避免重複產生無效的 Shape 介面。
- **AI 自我修正旁路**：
  - `src/feedback-loop.ts` 包含 TSC 錯誤診斷與 AI 修正邏輯，但為了避免 Rate Limit (429) 與 503 錯誤，在 `src/code-generator.ts` 中已將 `runFeedbackLoop` 調用註解（旁路關閉），非必要請勿隨意開啟。
- **語系要求**：所有對話、回覆、說明文件與 Releases.md 等，均必須使用 **繁體中文** 撰寫。

## 6.Operational Instructions
排除目錄：node_modules, .git, dist, dist-esm, temp.
