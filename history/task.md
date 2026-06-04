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

