# 修正 Vite 編譯與型別生成錯誤

---
**時間戳記**：2026-06-04 16:15:00

## 使用者審查要求
> [!IMPORTANT]
> 1. 本次變更將在 `src/code-generator.ts` 中加入自動型別清洗機制，清除 `types-observed.json` 中已有的空型別參數（例如 `Array<Array<Array<>>>` 將會被安全替換為 `Array<Array<Array<any>>>`）。
> 2. 我們將重新建置 CLI 工具，並重新執行專案轉換 `generate`，以驗證 Class Fields 重複宣告問題（`play: any`）是否已在 v1.1.9 的安全過濾中被修復。若依然生成，我們將在 `code-generator.ts` 中進一步調整 AST 欄位過濾邏輯。

## 開放問題
無。

## 預期變更
### js2ts-infer 重構工具

#### [MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- 於 `resolveParameterType` 函數的傳回值處理中，加入 `while (result.includes('<>')) { result = result.replace(/<>/g, '<any>'); }`。這可保證即使 `types-observed.json` 中含有舊有的 `Array<>` 等非法泛型寫法，亦能安全轉為 `Array<any>`。

## 驗證計畫
### 本地驗證
1. 於工具根目錄執行 `pnpm run build` 編譯最新 CLI。
2. 執行重構生成指令，覆蓋 `4_abcTS`：
   ```bash
   node dist/cli.js generate -i .\4_abc662 -o 4_abcTS --force
   ```
3. 檢查產出的 `4_abcTS/src/synth/synth-controller.ts` 與 `4_abcTS/src/parse/tune-builder.ts` 是否不再包含語法錯誤。
4. 於 `4_abcTS` 目錄執行 `pnpm run dev`，驗證 Vite 開發伺服器能否無錯啟動。
