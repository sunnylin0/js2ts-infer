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

---

# 實作非同步函數呼叫關係鏈 (Call Graph) 收集與互動式視覺化

**時間戳記**：2026-06-04 16:47:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **非同步與 Callback 呼叫鏈代理追蹤**：
>    - 在 `tracker-client.ts` 中維護全域 `callStack` 陣列。
>    - 實作非同步 `wrapFunction` 閉包擷取其創建時 the caller，並在回呼執行時模擬壓入執行上下文，以打通跨非同步與 Promise 事件迴圈的呼叫鏈。
> 2. **靜態與動態混合模式**：
>    - 在 `scan` 靜態掃描階段，分析 top-level 的 imports / require，以及函數內部的 `CallExpression`。
>    - 解析 local functions 與導入模組導出的靜態對應關係，產出潛在關係並在畫布上以 **虛線** 渲染，與動態呼叫資料（實線 + 發光 + 次數）無縫整合。
> 3. **防禦性設計**：
>    - **Error Recovery**：對例外狀況採用 `splice` 往後清理機制，防堵呼叫棧崩潰。
>    - **Recursion Limit**：限制 `callStack` 最大長度為 200。
>    - **High-Frequency Filter**：支援 `js2ts.config.json` 中的 `excludeCallGraph` 排除模式。
> 4. **佈局保存與 SVG 匯出**：
>    - 支援拖曳節點並固定。
>    - 提供 `儲存佈局` 功能至 `visualizer-layout.json`。
>    - 提供 `匯出 SVG` 功能。

## 開放問題
無。

## 預期變更

### 1. 核心插樁與收集層
- **[MODIFY] [babel-plugin-js2ts.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/babel-plugin-js2ts.ts)**: 載入 `excludeCallGraph`。在 `Function` 中，將函數體包裹在 `try-finally` 中，於進入和離開時呼叫 `enter` 與 `exit`。
- **[MODIFY] [tracker-client.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/tracker-client.ts)**: 實作 `enter`/`exit` 與呼叫棧、`callGraph`。在 `wrapFunction` 中捕捉 `parentCaller` 並在 callback 執行時暫時推入呼叫棧。
- **[MODIFY] [tracker-server.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/tracker-server.ts)**: 於 `/types` 路由對 `"__callGraph"` 做特別累加處理。
- **[MODIFY] [type-merger.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/type-merger.ts)**: 對 `"__callGraph"` 鍵值進行特殊分支處理，累加合併兩個 database 中的呼叫關係鏈。

### 2. 靜態分析與 CLI 命令層
- **[MODIFY] [static-analyzer.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/static-analyzer.ts)**: 掃描 AST 提取 `ImportDeclaration`、`require` 與 `CallExpression` 以偵測潛在呼叫關係，輸出至 `boundary-map.json`。
- **[MODIFY] [commands/init.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/commands/init.ts)**: 於 `DEFAULT_CONFIG` 中加入 `excludeCallGraph: []`。
- **[MODIFY] [cli.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/cli.ts)**: 註冊 `visualize` 指令。
- **[NEW] [commands/visualize.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/commands/visualize.ts)**: 實作 Web 伺服器，Serve 視覺化 HTML 與提供資料/佈局 API。
- **[NEW] [templates/visualizer.html](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/templates/visualizer.html)**: D3.js 畫布、霓虹美學控制面板與各項交互功能。

## 驗證計畫
### 自動化/手動驗證
1. 於 `3_Snake` 專案執行 `scan`，驗證 `boundary-map.json` 是否正確生成靜態依賴。
2. 執行 `run` 指令，開啟瀏覽器操作，檢查 `types-observed.json` 是否有 `__callGraph` 的累加次數。
3. 執行 `visualize` 啟動視覺化伺服器，驗證拖曳固定、佈局儲存、圖表切換、SVG 匯出。

---

# 實作類別級 (Class-level) 關係鏈收集與視覺化

**時間戳記**：2026-06-04 17:15:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **類別方法與建構子追蹤命名優化**：
>    - 在 `babel-plugin-js2ts.ts` 中，將 Class Method 及 Class Field 箭頭函數的追蹤 ID 自動加上 `ClassName.` 前綴。
> 2. **型別注入相容性修正**：
>    - 同步更新 `code-generator.ts` 中 Class Method 的型別標註對齊 `ClassName.methodName` 規格。
>    - 清洗標註參數所產生的 interface 名稱，移去點號字元，避免 TS 語法錯誤。
> 3. **類別級靜態與動態分析**：
>    - 靜態分析：在 `static-analyzer.ts` 採用雙階段掃描，提取 `ClassDeclaration` AST 中的 `NewExpression` 與 `CallExpression`（靜態方法調用），輸出 `staticCallGraph.classes`。
>    - 動態分析：在視覺化頁面，整合 `types-observed.json` 中 `__callGraph` 的 `filePath::ClassName.methodName` 呼叫次數，將其映射至對應的 Class 節點。
> 4. **檢視層級擴充**：
>    - 於 `visualizer.html` 檢視層級新增「類別級 (Class-level)」選項。

## 開放問題
無。

## 預期變更

### 1. 核心收集與重構層
- **[MODIFY] [babel-plugin-js2ts.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/babel-plugin-js2ts.ts)**: 修改 `getFunctionName`，在處理類別方法與類別欄位 ArrowFunction 時自動加上 `ClassName.` 前綴。
- **[MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)**: 標註方法時傳遞 `fnName` 為 `${cls.getName()}.${fnName}`，並在 `annotateFunction` 內對 interface name 的 `baseName` 進行 `replace(/\./g, '')` 處理。

### 2. 靜態分析與視覺化層
- **[MODIFY] [static-analyzer.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/static-analyzer.ts)**: 擴充為雙階段掃描以確實識別並記錄類別依賴，輸出 `staticCallGraph.classes`。
- **[MODIFY] [templates/visualizer.html](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/templates/visualizer.html)**: 新增「類別級 (Class-level)」選項與對應的 `buildGraphData` 節點及連線對應邏輯。

## 驗證計畫
### 本地測試
1. 執行 `scan` 驗證 `boundary-map.json` 是否正確生成 `staticCallGraph.classes`。
2. 執行 `run` 驗證 `types-observed.json` 中動態呼叫鏈是否加上 Class 前綴。
3. 執行 `generate` 驗證型別標註生成無錯，且 interface 名稱合法。
4. 執行 `visualize` 驗證「類別級」視覺化顯示正確，並能與動態實線、靜態虛線無縫整合。

---

# 實作類別級 (Class-level) 關係鏈收集與視覺化 - 執行成果

**時間戳記**：2026-06-04 17:26:00

## 影響檔案
- `src/static-analyzer.ts`
- `src/babel-plugin-js2ts.ts`
- `src/code-generator.ts`
- `src/templates/visualizer.html`

## 執行與部署計畫成果
1. **靜態分析**：雙階段 AST 掃描順利提取專案內之 Class 關係，輸出至 `boundary-map.json` 的 `staticCallGraph.classes` 欄位。
2. **動態側錄**：`babel-plugin-js2ts.ts` 的 `getFunctionName` 與 `tracker-client.ts` 均能對類別方法/建構函式精確補上 `ClassName.` 前綴（例如 `ParticleSystem.spawn`），並存檔於 `types-observed.json` 中之 `__callGraph` 的 `graph` 鍵內。
3. **型別注入與清洗**：對齊重構後的型別標註規格，並於 `code-generator.ts` 自動清洗 interface 名稱中的點號，避免語法錯誤（已將 `Particle.constructor` 清洗為 `ParticleconstructorSvgShape`）。
4. **互動式視覺化**：於檢視層級新增「類別級 (Class-level)」選單與聚合繪製邏輯，D3.js 關係圖繪製流暢。

---

# 修正重構後的 4_abcTS 開發與打包設定

**時間戳記**：2026-06-05 09:16:00

## 影響檔案
- `4_abcTS/vite.config.ts`

## 預期變更
- 註解 `vitePlugin`，避開一般開發環境下的型別側錄伺服器連線問題。
- 搬移 `server` 設定至 Vite 的頂層配置，使 HMR 與自動開頁生效。
- 修改 `entry` 點為 `index.ts`。

---

# 啟用並封裝 TypeScript 宣告檔 (Declaration)

**時間戳記**：2026-06-05 09:27:00

## 影響檔案
- `tsconfig.json`
- `package.json`

## 預期變更
- 於 `tsconfig.json` 內新增 `"declaration": true` 以在編譯時輸出 `.d.ts` 宣告檔。
- 於 `package.json` 內將 `exports` 的路徑映射改為物件包裝，增加對應的 `"types"` 分支，將宣告路徑指向 `./dist/*.d.ts`，以便提供外部強型別 IDE 提示與編譯支援。

---

# 於 `js2ts-infer generate` 排除轉譯 config 檔

**時間戳記**：2026-06-05 13:26:00

## 影響檔案
- `src/code-generator.ts`

## 預期變更
- 於 `src/code-generator.ts` 的 `files` 遍歷中加入檔名過濾。
- 對於主檔名是 `vite.config` 或 `webpack.config` 的檔案直接執行 `continue` 跳過，不進行 TS 語法標註與轉譯重寫，保留原樣。



