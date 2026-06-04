# 目前工作進度與摘要 (NOTES.md)

## 1. 目前進度 (最後處理到哪裡)
- **Class 建構函式型別注入 (v1.1.4)**：修復了 `js2ts-infer` 工具在生成型別時遺漏遍歷 `cls.getConstructors()` 的問題。現已能自動將 `types-observed.json` 中側錄到的建構函式參數型別（如 `particles.ts` 中的 `x: number, y: number, color: string`）精確寫入生成的 TypeScript 檔案中。
- **無依賴屬性置頂初始化與 JSDoc 升級 (v1.1.3)**：自動將 `constructor` 內不依賴參數的 `this.xxx = yyy` 語句及其註解（自動升級為 JSDoc）搬移至 Class 頂部作為屬性初始值，使 Class 成員結構更現代化，並從 `constructor` 中安全移除。
- **端到端驗證**：已在 `3_Snake` 專案上成功執行 `js2ts-infer generate --force` 重構。驗證結果顯示 `Particle` 與 `Snake` 的 `constructor` 及置頂屬性均符合預期地被注入。
- **專案發行日誌**：每次修改大綱皆已詳實記錄於根目錄的 [Releases.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/Releases.md)。

## 2. 當前重點 (核心內容)
- **雙通道型別推導與注入**：透過動態代理/插樁 (Runtime Trace) 收集型別，並利用 `ts-morph` 進行 AST 重構。
- **Class 結構重構安全**：Class 的重構需要確保：
  1. 所有 `this.xxx` 的動態成員都必須在 Class 最頂部（第一順位）有顯式屬性宣告（避免 TS 報錯）。
  2. 確保註解被升級為 JSDoc，並妥善遷移。
  3. `constructor` 的參數與型別能正確對齊側錄到的資料。

## 3. 待處理事項 (接下來要做什麼)
- **修正 `3_Snake` 專案的 `index.html` 引用**：重構後產生的 TS 檔案已刪除原來的 `.js`。需要將 `3_Snake/index.html` 中的 `<script src="/src/main.js">` 修改為 `<script src="/src/main.ts">` 以便 Vite 正常載入與編譯。
- **執行其餘專案轉換**：對工作區中的其他 JS 專案（例如 `4_abc662` 等）進行完整的型別側錄與轉換流程。
- **互動式審閱補完**：針對重構完成後的 TS 檔案，執行 `js2ts-infer review`，人工作業細修殘留的 `any` 並重新命名不夠直覺的介面名稱。

## 4. 核心設定 (需要保持的風格與規範)
- **依賴管理**：JS/TS 專案管理一律使用 `pnpm` 工具。
- **語系要求**：所有對話、回覆、說明文件、`Releases.md`、`task.md` 及 `implementation_plan.md` 均須使用 **繁體中文**。
- **代碼品質**：轉換生成的 TypeScript 程式碼不可有任何 TypeScript 編譯錯誤（無 syntax / semantic error），且需符合使用者的 Prettier 格式偏好。
- **記錄規範**：每次對話有任何代碼變更或重構大綱，都必須同步更新至根目錄的 [Releases.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/Releases.md)。
