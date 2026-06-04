# 🚀 Project Blueprint: js2ts-infer
  是將 Javascript 轉成 Typescript 的工具
  
## 1. 核心技術棧 (Multi-Stack Details)
- **Runtime**: Node.js >= 18.0.0
- **Languages**: TypeScript (TS), JavaScript (JS)

## 2. 專案架構 (Architecture)
```text
c:\Users\ESAO_NB27\Desktop\abc_js2ts
├── dist/                          # 編譯後的 CommonJS 與 ESM 產物
├── hlog/                          # 歷史執行計畫、任務與導覽記錄
│   ├── 0implementation_plan.md
│   ├── 0task.md
│   └── 0walkthrough.md
├── src/                           # 核心 TypeScript 原始碼
│   ├── commands/                  # CLI 子指令實作 (init, scan, run, merge, generate, review)
│   │   ├── generate.ts
│   │   ├── init.ts
│   │   ├── merge.ts
│   │   ├── review.ts
│   │   ├── run.ts
│   │   └── scan.ts
│   ├── babel-plugin-js2ts.ts      # Babel AST 插樁插件
│   ├── cli.ts                     # CLI 入口
│   ├── code-generator.ts          # ts-morph 型別注入與重構生成器
│   ├── interactor.ts              # 互動式 any 審閱與介面重命名器
│   ├── loader-hook-esm.ts         # ESM 執行期插樁攔截器
│   ├── loader-hook.ts             # CommonJS 執行期插樁攔截器
│   ├── plugins.ts                 # Vite 與 Webpack 插件/載入器接口
│   ├── static-analyzer.ts         # 靜態 Exports 與 Class 掃描器
│   ├── tracker-client.ts          # 注入執行期的全域 __typeTracker 側錄器
│   └── tracker-server.ts          # 背景型別收集 Express/HTTP 伺服器
├── package.json                   # 專案配置與 npm 依賴
├── pnpm-lock.yaml                 # pnpm 鎖定檔
├── tsconfig.json                  # CommonJS 編譯配置
├── tsconfig.esm.json              # ESM 編譯配置
├── build-post.js                  # 後置處理腳本，複製/重命名 ESM hook 並清理暫存目錄
└── Releases.md                    # 專案發行與修改日誌
```

## 3.開發規範與禁忌 (Project-Specific Rules)
Legacy Support: 本專案為純 Node.js / TypeScript 開發。

Type Safety: TS 專案需遵循嚴格型別檢查。在修改 `src/` 中的程式碼時，請確保無 TypeScript 編譯錯誤。

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
- **語系要求**：所有對話、回覆、說明文件與 Releases.md 等，均必須使用 **繁體中文** 撰寫。

## 6.Operational Instructions
排除目錄：node_modules, .git, dist, dist-esm, temp.
