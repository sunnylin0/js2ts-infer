# 任務進度追蹤

---
**時間戳記**：2026-06-04 16:16:00

- [x] 修正 `resolveParameterType` 清除空泛型 (`Array<>`)
- [x] 編譯專案 `pnpm run build`
- [x] 執行 `js2ts-infer generate` 覆蓋 `4_abcTS`
- [x] 驗證 `4_abcTS/src/parse/tune-builder.ts` 及 `4_abcTS/src/synth/synth-controller.ts` 的型別生成正確性
- [x] 於 `4_abcTS` 目錄下跑 `pnpm run dev` 驗證 Vite 是否順利啟動

---

# 任務進度追蹤

**時間戳記**：2026-06-04 16:49:00

- [x] 呼叫關係鏈 (Call Graph) 收集與視覺化
  - [x] 擴充 `src/commands/init.ts` 支援 `excludeCallGraph` 設定
  - [x] 註冊 `visualize` 指令到 `src/cli.ts`
  - [x] 於 `src/static-analyzer.ts` 實作靜態 Imports、Requires 與 CallExpression 掃描
  - [x] 於 `src/tracker-server.ts` 支援 `__callGraph` 的特別合併與持久化
  - [x] 於 `src/type-merger.ts` 支援多端 `__callGraph` 的無損合併
  - [x] 修改 `src/babel-plugin-js2ts.ts` 實現進入/離開插樁，並整合高頻篩選器
  - [x] 升級 `src/tracker-client.ts` 實作 `callStack` 追蹤、Error Recovery、非同步/Callback `parentCaller` 閉包代理
  - [x] 實作 `src/commands/visualize.ts` 網頁伺服器及 API 端點
  - [x] 實作 `src/templates/visualizer.html` D3.js v7 霓虹互動架構圖
  - [x] 使用 `3_Snake` 專案執行靜態掃描與執行期側錄，確認 `boundary-map.json` 與 `types-observed.json` 中包含呼叫鏈
  - [x] 執行 `visualize` 啟動檢視工具，測試畫布平移、節點拖曳固定、佈局儲存、圖表切換與 SVG 匯出

---

# 任務進度追蹤

**時間戳記**：2026-06-04 17:16:00

- [x] 類別級 (Class-level) Call Graph 關係鏈收集與視覺化
  - [x] 於 `src/static-analyzer.ts` 實作雙階段掃描以識別靜態類別依賴，輸出 `staticCallGraph.classes`
  - [x] 修改 `src/babel-plugin-js2ts.ts` 的 `getFunctionName` 為類別方法與類別欄位 ArrowFunction 加入 `ClassName.` 前綴
  - [x] 修改 `src/code-generator.ts` 對齊類別方法 `ClassName.methodName` 規格，並在 `annotateFunction` 中清洗 interface name
  - [x] 於 `src/templates/visualizer.html` 新增「類別級 (Class-level)」檢視模式與圖表建構邏輯
  - [x] 使用 `3_Snake` 專案執行靜態掃描與執行期側錄，確認 `boundary-map.json` 與 `types-observed.json` 中包含類別級依賴與類別前綴
  - [x] 執行 `generate` 重構代碼，確認生成無錯
  - [x] 啟動視覺化工具，測試切換至「類別級」的顯示與佈局保存功能

---

# 任務進度追蹤

**時間戳記**：2026-06-04 17:26:00

- [x] 類別級 (Class-level) Call Graph 關係鏈收集與視覺化任務已全面完成並成功驗證。

---

# 任務進度追蹤

**時間戳記**：2026-06-05 09:16:00

- [x] 修正重構後的 4_abcTS 開發與打包設定
  - [x] 於 `4_abcTS/vite.config.ts` 註解 `vitePlugin` 以防一般開發模式下因型別伺服器未啟動而產生的 `globalThis.__typeTracker is not a function` 錯誤
  - [x] 將 `server` 設定搬移至最頂層，對齊 Vite 標準配置
  - [x] 將 `build.lib.entry` 入口路徑指向重構後的 `index.ts`
  - [x] 驗證 `pnpm run build:vite` 通過

---

# 任務進度追蹤

**時間戳記**：2026-06-05 09:27:00

- [x] 啟用並封裝 TypeScript 宣告檔 (Declaration)
  - [x] 於 `tsconfig.json` 啟用 `declaration: true` 編譯設定
  - [x] 於 `package.json` 的 `exports` 新增對應的 `types` 分支
  - [x] 重新執行 `pnpm run build`，成功產出所有 `*.d.ts` 檔案並通過建置

---

# 任務進度追蹤

**時間戳記**：2026-06-05 13:26:00

- [x] 於 `js2ts-infer generate` 排除轉譯 config 檔
  - [x] 修改 `src/code-generator.ts`，對檔名包含 `vite.config.` 與 `webpack.config.` 的檔案直接予以跳過
  - [x] 重新編譯專案並執行測試，驗證 `vite.config.js` 確實未被轉譯且安全保留原樣


