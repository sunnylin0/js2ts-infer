# 任務進度追蹤 (`task.md`)

此文件用於追蹤團隊各角色的任務執行狀況。

## 📋 [PM] 任務與商業邏輯
- [x] 初始化 `js2ts-infer` 專案 (pnpm) 與 `package.json` 配置
- [x] 實作 `init` 指令：產生預設 `js2ts.config.json` 設定檔
- [x] 實作 `merge` 指令：多端 JSON 型別資料增量合併 (Upsert)

## 📐 [架構師] 系統架構與資料合約
- [x] 實作 `scan` 指令：建立 Class 定義地圖並識別邊界 API/Exports，輸出 `boundary-map.json`
- [x] 實作 `run` 指令與全域 `__typeTracker` HTTP 背景 Receiver 伺服器
- [x] 設計雙通道（Node.js / 瀏覽器前端）攔截架構與 Vite/Webpack plugin 接口

## 💻 [軟體工程師] 實作與程式碼生成
- [x] 實作靜態/動態 Babel AST 插樁器 (Babel plugin)
- [x] 實作 Node.js 執行期 require Hook (CJS) 與 ESM Loader Hook
- [x] 實作 `generate` 指令：執行型別雙向傳播與 ts-morph 程式碼注入（包含 CommonJS 轉 ESM）
- [x] 實作 `review` 指令：終端互動式 Review 介面

## 🧪 [測試工程師] 驗證與測試
- [x] 驗證合併邏輯與 `merge` 指令功能 (TC-002)
- [x] 驗證 HTTP Receiver 伺服器功能 (TC-003)
- [x] 驗證 Git 安全防護與 `--dry-run` 模式 (TC-004, TC-005)
- [x] 在測試專案（如 `2_MathCal`）中進行端到端型別推導與轉換

---

### [2026-06-04 14:35] 任務：呼叫關係鏈 (Call Graph) 側錄與視覺化
- [ ] 修改 `babel-plugin-js2ts.ts` 插入 enter/exit 追蹤函數。
- [ ] 升級 `tracker-client.ts` 支援呼叫棧、非同步與 callback 代理呼叫追蹤。
- [ ] 修改 `static-analyzer.ts` 實作靜態 `import`/`require` 呼叫依賴分析。
- [ ] 升級 `tracker-server.js` 與合併機制，支援 `"__callGraph"` 資料存儲。
- [ ] 實作 `visualizer.ts` 與 D3.js `visualizer.html` 力導向互動圖檢視網頁。
- [ ] 在 `3_Snake` 專案中驗證動靜態混合 Call Graph 是否產出，且可在瀏覽器網頁中拖曳並切換顯示。

---

### [2026-06-04 14:50] 任務：支援目錄匯出與複製品質重構
- [x] 修改 `src/cli.ts` 註冊 `--out-dir` 參數與 `--in-dir` 參數。
- [x] 修改 `src/commands/generate.ts` 與 `src/code-generator.ts` 實作來源目錄複製與目標目錄型別注入。
- [x] 執行 E2E 驗證，確認來源專案未被刪除，且目標專案完整且成功編譯。
- [x] 修正為 `--in-dir` 與 `--out-dir` 參數，更新 `processFileRefactoring` 的 `inDir` 相對路徑計算與所有相關組態/側錄檔讀取基準。

---

### [2026-06-04 15:20] 任務：增量目錄複製與型別覆寫保護
- [x] 於 `src/code-generator.ts` 的 `fs.cpSync` 篩選器中新增 `destPath` 存在性檢查，避免覆寫目標目錄中已有的檔案。
- [x] 驗證重構後轉換生成的 `*.ts` 仍可正確覆寫並更新目標目錄中的型別宣告。

---

### [2026-06-04 15:40] 任務：支援 Vite 8 運行 (解決 ERR_REQUIRE_ESM)
- [x] 於 `src/commands/run.ts` 移除 Node.js >= 22 的 `--no-experimental-require-module` 注入。
- [x] 重新編譯專案並在 `4_abc662` 中驗證 `js2ts-infer run "pnpm run dev"` 成功啟動 Vite 開發伺服器。
- [x] 成功引導在瀏覽器中打開 `http://localhost:5174/editor.html`。

---

### [2026-06-04 15:55] 任務：提升 Class Fields 屬性搬移安全性
- [x] 於 `src/code-generator.ts` 的唯讀收集階段，排除同名 Method、重複聲明、以及依賴 `this.` 的表達式。
- [x] 重新生成 `4_abcTS` 並成功以 `pnpm run dev` 啟動且無任何 Parse Error。
