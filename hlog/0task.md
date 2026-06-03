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
- [x] 在測試專案（如 `2_MathCal`）中進行端到端轉換驗證
