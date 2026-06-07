# 修正 Vite 編譯與型別生成錯誤

---
**時間戳記**：2026-06-04 16:15:00

## 使用者審查要求
> [!IMPORTANT]
> 1. 本次變更將在 `src/code-generator.ts` 中加入自動型別清洗機制，清除 `types-observed.json` 中已有的空型別參數（例如 `Array<Array<Array<>>>` 將會被安全替換為 `Array<Array<Array<any>>>`）。
> 2. 我們將重新建置 CLI 工具，並重新執行專案轉換 `generate`，以驗證 Class Fields 重重複宣告問題（`play: any`）是否已在 v1.1.9 的安全過濾中被修復。若依然生成，我們將在 `code-generator.ts` 中進一步調整 AST 欄位過濾邏輯。

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
>    - 同步更新 `code-generator.ts` 中 Class Method 的型別注入規格。
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
4. 執行 `visualize` 驗證「類別級」視覺化顯示正確，並能與動態實線、靜態灰色虛線無縫整合。

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

---

# 支援讀取與利用 `*.d.ts` 宣告檔型別進行精準重構

**時間戳記**：2026-06-05 13:45:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **載入 `*.d.ts` 宣告檔**：
>    - 工具在 `js2ts-infer generate` 時，應自動掃描專案目錄內所有 `*.d.ts`（例如 `4_abc662/type/index.d.ts`）並載入至 ts-morph 專案。
> 2. **精準型別對齊與替換**：
>    - 重構 Class（如 `Tune`、`EngraverController`）時，若在宣告檔中找到同名 interface，其屬性及方法型別應優先使用 `.d.ts` 中定義的精確型別（例如將 `engraver: any` 轉換成 `engraver: EngraverController`），避免產出大量 `any`。
> 3. **安全回退與容錯**：
>    - 當宣告檔無定義或為 `any` 時，安全回退至動態側錄（`typeDB`）推導邏輯。

## 開放問題
無。

## 預期變更
### js2ts-infer 重構工具

#### [MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- **載入型別定義**：重構 `runGeneration` 以在全域維護單一 `Project` 實例，並在啟建立時透過 `globSync` 搜尋並使用 `project.addSourceFileAtPath` 載入專案內所有的 `*.d.ts` 檔案。
- **共享 Project 實例**：將全域 `project` 作為參數傳遞給 `processFileRefactoring`。在每次檔案處理完畢後，呼叫 `project.removeSourceFile(sourceFile)` 以防殘留。
- **介面尋找與屬性型別覆寫**：
  - 實作 `findInterfaceInProject` 輔助函數，遍歷專案內所有 Interface 定義以查找與 Class 同名的 Interface。
  - 在 Class 處理 of 最後階段，遍歷 Class 所有 properties（包含搬移或新宣告的屬性），若同名 Interface 中存在精確型別定義，則將其原本的 `any` 覆寫為宣告檔定義型別。
- **方法參數與傳回值對齊**：
  - 升級 `annotateFunction` 支援 `dtsInterface`。
  - 當方法在同名 Interface 中有對應的 MethodSignature 或 FunctionType 定義時，其參數型別與傳回值型別優先與宣告檔中的型別對齊；否則安全回退至側錄推導。

## 驗證計畫
### 本地測試
1. 於工具根目錄執行 `pnpm run build` 編譯最新 CLI。
2. 執行重構生成指令，覆蓋 `4_abcTS`：
   ```bash
   node dist/cli.js generate -i .\4_abc662 -o .\4_abcTS -f
   ```
3. 檢查產出之 `4_abcTS/src/data/abc_tune.ts` 與 `4_abcTS/src/write/engraver-controller.ts` 的型別生成正確性，確保 `engraver`、`renderer`、`staffgroups` 等屬性已被正確標註為 `EngraverController`、`Renderer`、`StaffGroupElement[]` 等精準型別而非 `any`。

---

# 實作 AST 型別正反向傳播與自動延伸機制

**時間戳記**：2026-06-05 14:15:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **區域變數型別正向傳播**：
>    - 依據 Class 已知屬性（例如 `lines: Lines[]`），透過 ts-morph 取得區域變數初始化運算式的推推導型別，自動為方法內部的局部變數（例如 `var line: Lines`、`var staff: Staff` 等）加上精確型別標註。
> 2. **方法參數型別反向傳播**：
>    - 掃描 Class 內部的呼叫表達式（例如 `this.computePickupLength(this.lines, barLength)`），取得引數的推導型別，並自動為被呼叫方法的對應參數（例如 `computePickupLength` 的 `lines` 參數）標註型別。
> 3. **方法傳回值型別傳播**：
>    - 透過 AST 分析方法的推導傳回型別，自動標註方法的回傳值型別（例如 `getElementFromChar(char): Voice | null`）。

## 開放問題
無。

## 預期變更
### js2ts-infer 重構工具

#### [MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- **型別清理輔助函數**：實作 `getCleanTypeText`，只保留合法、非 inline 且非 any 的型別名稱，並過濾掉命名空間字尾與 inline object 雜訊。
- **正向傳播 (區域變數)**：在重構 Class 屬性後，遍歷所有方法的區域變數宣告，藉由 `decl.getInitializer()?.getType()` 獲取並標註其型別。
- **反向傳播 (參數型別)**：遍歷 Class 中的 `CallExpression`（以 `this.` 呼叫的方法），將引數的推導型別傳遞給被呼叫方法的參數。
- **傳回值傳播**：遍歷 Class 的所有方法，藉由 `method.getReturnType()` 取得方法的推導傳回型別並對齊。

## 驗證計畫
### 本地測試
1. 於工具根目錄執行 `pnpm run build` 編譯最新 CLI。
2. 執行重構生成指令，覆蓋 `4_abcTS`：
   ```bash
   node dist/cli.js generate -i .\4_abc662 -o .\4_abcTS -f
   ```
3. 檢查產出之 `4_abcTS/src/data/abc_tune.ts` ，確認 `getElementFromChar`、`computePickupLength`、`getMeter` 等方法及其內部的 `line`、`staff`、`voice` 等局部變數是否被成功標註上正確的 `Voice`、`Lines`、`Staff`、`Voice[]` 型別，並確認 `getMeter(): Meter` 及 `getElementFromChar(): Voice | null` 傳回值型別。

---

## [2026-06-05] 技術問答 - 提升型別準確率之架構與方案評估

### 評估目標
探討如何整合既有 `*.d.ts`、靜態分析與動態側錄，並提出能夠突破現行限制、提升重構型別準確率的延伸方案。

### 影響層面
- 概念性設計評估，無直接程式碼變更。
- 後續 `code-generator` 或 `js2ts-infer` 的演進方向。

---

## [2026-06-05] 設計規格 - TSC 編譯錯誤反饋循環與 AI 自我修正設計方案

### 評估目標
整合 TypeScript Compiler 診斷與 AI 修正模組，設計一個能夠自我收斂並消除編譯錯誤的重構管線。


### 影響層面
- 提出完整的 JSON Schema 供 LLM 重構使用。
- 說明編譯錯誤代碼（如 TS2322, TS2339 等）與 AST 節點位置的對應與 Patch 應用。

- 修改並格式化 v2 設計規格文件中的注入架構四步驟。
- 補充並完備 1.5 節中關於 TSC 反饋循環自我修正的理由與實作摘要。

---

# 規劃 `generate` 階段型別注入完整設計方案

**時間戳記**：2026-06-05 15:05:00

## 使用者審查要求
> [!IMPORTANT]
> 1. 釐清設計規格中「讀取既有宣告檔建立型別地圖」應置於何處。
> 2. 彙整 `v2/tsc_feedback_loop_design.md`，詳列完整的 `generate` 階段執行流程細節。

## 開放問題
無。

## 預期變更
### 重構工具說明文件

#### [MODIFY] [tsc_feedback_loop_design.md](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/v2/tsc_feedback_loop_design.md)
- 合併原本 of TSC 反饋循環設計，並將第一到第四階段（宣告檔載入、JSDoc與靜態分析、AST正反向傳播、動態側錄兜底）的實作細節進行完整補全，形成 generate 階段的終極型別重構設計方案。

## 驗證計畫
### 本地測試
1. 檢查 `v2/tsc_feedback_loop_design.md` 內容完整性與 Markdown 語法格式。

---

# 實作 TSC 編譯錯誤反饋循環與 AI 自我修正

**時間戳記**：2026-06-05 15:15:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **實作 TSC 診斷**：使用 `typescript` Compiler API 載入所有轉換後的 `.ts` 檔案，提取語義錯誤（TS2322, TS2339, TS2345, TS2531, TS2532 等）。
> 2. **AI 修正與 Patch 應用**：若有 API Key（讀取環境變數 `GEMINI_API_KEY` 或 config 裡的 `aiApiKey`），自動對錯誤點抓取前後 15 行上下文，呼叫 Gemini API 生成修復補丁 (JSON 格式)，並使用 `ts-morph` 或檔案寫入套用補丁。
> 3. **收斂控制**：最高 5 次迭代。如果錯誤沒減少且類型相同，或者嘗試 3 次仍未解決，則自動退回 `any` 兜底防禦，避免死循環。

## 開放問題
無。

## 預期變更
### 核心指令與設定層
#### [MODIFY] [init.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/commands/init.ts)
- 於 `DEFAULT_CONFIG` 新增 `aiApiKey: ""`、`aiModel: "gemini-2.5-flash"` 與 `maxFeedbackIterations: 5`。

### 重構生成層與分檔
#### [MODIFY] [code-generator.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/code-generator.ts)
- 僅保留 `runGeneration` 等整體 CLI 重構管線控制邏輯、目錄複製與檔案 IO。
- 引入並調用 `ast-refactorer.ts` 與 `feedback-loop.ts`。

#### [NEW] [ast-refactorer.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/ast-refactorer.ts)
- 移入 `processFileRefactoring`、`annotateFunction`、`refactorCjsToEsm` 等 AST 型別標記與傳播邏輯。

#### [NEW] [feedback-loop.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/feedback-loop.ts)
- 實作 `runFeedbackLoop`，負責建立 `ts.Program`、取得診斷資訊、向 Gemini API 發送請求並套用修復 Patch，包含 max feedback 迭代、降級 any 兜底等邏輯。

## 驗證計畫
### 自動化與手動驗證
1. 於工具目錄執行 `pnpm run build`。
2. 執行重構生成（直接覆蓋 4_abcTS）：
   ```bash
   node dist/cli.js generate -i ./4_abc662 -o ./4_abcTS -f
   ```
3. 驗證代碼是否在前四步完成後直接寫入，不觸發 AI 自我修正，避免被 Rate Limit 卡死。

---

# 修正字面量型態過度收窄與優化 return 型態推導策略

**時間戳記**：2026-06-05 16:45:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **修正數字字面量型態過度收窄問題**：
>    - 避免將 `var pickupLength = 0;` 推導為 `pickupLength: 0`；避免將方法參數 `barLength` 標註為 `0`；避免將 `den`, `num` 標註為 `4`。
>    - 所有數字、字串、布林等字面量類型在做型態標註時，皆應安全寬化 (Widen) 至基礎類型（`number`, `string`, `boolean`）。
> 2. **優化方法回傳值型態推導與 Interface 避免重複產生**：
>    - 避免 `getMeter()` 產生無效的 `TunegetMeterReturnShape`。
>    - 若 AST 靜態語意分析可以直接推導出精確型態（例如 `Meter`，`Key | {}`），應優先使用 AST 推導，而非無條件套用 `typeDB` 側錄所得的臨時 Interface Shape。

## 開放問題
無。

## 預期變更
### js2ts-infer 重構工具

#### [MODIFY] [ast-refactorer.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/ast-refactorer.ts)
- **實作 `widenTypeName`**：遞迴處理並寬化 `'true'`, `'false'`, 數字字面量（使用 `Number()` 排除 NaN 健全判斷）、引號字串字面量，且支援 Union 型態拆分再合併的寬化。
- **更新 `resolveParameterType` 與 `getCleanTypeText`**：套用 `widenTypeName` 對 `observedTypes` 與 AST 所得型態字串進行清洗。
- **重構 `annotateFunction` 傳回值標註**：移出 fallback 至 `typeDB` 的傳回值處理邏輯。
- **實作 `resolveAndSetReturnType`**：統一對 AST 靜態型態與 `typeDB` 側錄進行優先度排序（AST 優先，若為 `any` 則以 `typeDB` 兜底），並在 Class method 及一般 Function/ArrowFunction 解析後半段統一呼叫。

## 驗證計畫
### 本地測試
1. 執行 `pnpm run build` 編譯最新 CLI。
2. 執行重構生成：
   ```bash
   node dist/cli.js generate -i ./4_abc662 -o ./4_abcTS -f
   ```
3. 檢查 `4_abcTS/src/data/abc_tune.ts` 是否不再包含 `0`, `4` 等字面量型態，且 `getMeter()` 回傳 `Meter`，`getKeySignature()` 回傳 `Key | {}`。

---

# 修復 InterfaceDeclaration 的方法簽章讀取 Bug 與打通 index.d.ts 型別系統

**時間戳記**：2026-06-05 17:50:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **修復同名 interface 的方法型別注入無效之問題**：
>    - 使用者在 `index.d.ts` 中已將 `EngraverController` 的方法簽章定義清楚，但工具之前依然生成了大量多餘的 `*Shape`（如 `EngraverControllerengraveABCAbctunesShape` 等），需要徹底排除此問題，提高對齊正確率。

## 開放問題
無。

## 預期變更
### js2ts-infer 重構工具

#### [MODIFY] [ast-refactorer.ts](file:///c:/Users/ESAO_NB27/Desktop/abc_js2ts/src/ast-refactorer.ts)
- **支持 InterfaceDeclaration 獲取 MethodSignature**：修復 `annotateFunction` 中以 `dtsInterface.getMethod` 獲取簽章的錯誤，針對 `InterfaceDeclaration` 應呼叫 `getMethodSignature` 才能正確獲取，使其相容 Class 與 Interface。

## 驗證計畫
### 本地測試
1. 執行 `pnpm run build` 編譯 CLI。
2. 執行 `node dist/cli.js generate -i ./4_abc662 -o ./4_abcTS -f`。
3. 檢查 `4_abcTS/src/write/engraver-controller.ts` 頂部是否不再有 `Tune` 相關的 shape 介面，且參數對齊 `Tune`。
4. 執行 `pnpm run build:vite` 驗證 `4_abcTS` 打包。

---

# 實作專案地圖初始化與 agent.md 生成

**時間戳記**：2026-06-06 04:26:00

## 使用者審查要求
> [!IMPORTANT]
> 1. 啟動「全自動專案地圖繪製」程序以生成 `agent.md`，詳述專案架構、開發規範與 AI 協作備忘錄。

## 開放問題
無。

## 預期變更
### 專案 Blueprint 指南
#### [NEW] [agent.md](file:///c:/Users/sunny/Desktop/abc_js2ts/agent.md)

## 驗證計畫
### 手動驗證
1. 確認 `agent.md` 檔案已正確在根目錄生成，內容符合混和技術棧規範。

---

# 為 src 目錄下所有 Function 撰寫頂級 JSDoc 註解

**時間戳記**：2026-06-06 06:01:00

## 使用者審查要求
> [!NOTE]
> 本次變更為全專案 `src/` 與 `src/commands/` 的核心功能代碼與指令子程式加入符合開發規範 [JSDOC_GUIDE.md](file:///c:/Users/sunny/Desktop/abc_js2ts/JSDOC_GUIDE.md) 的頂級 JSDoc/TSDoc 註解，不影響程式執行邏輯。

## 開放問題
無。

## 預期變更
### 核心指令與實作檔
- #### [MODIFY] [generate.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/commands/generate.ts)
- #### [MODIFY] [init.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/commands/init.ts)
- #### [MODIFY] [merge.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/commands/merge.ts)
- #### [MODIFY] [review.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/commands/review.ts)
- #### [MODIFY] [run.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/commands/run.ts)
- #### [MODIFY] [scan.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/commands/scan.ts)
- #### [MODIFY] [visualize.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/commands/visualize.ts)
- #### [MODIFY] [code-generator.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/code-generator.ts)
- #### [MODIFY] [ast-refactorer.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/ast-refactorer.ts)
- #### [MODIFY] [feedback-loop.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/feedback-loop.ts)
- #### [MODIFY] [static-analyzer.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/static-analyzer.ts)
- #### [MODIFY] [tracker-client.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/tracker-client.ts)
- #### [MODIFY] [tracker-server.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/tracker-server.ts)
- #### [MODIFY] [type-merger.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/type-merger.ts)
- #### [MODIFY] [babel-plugin-js2ts.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/babel-plugin-js2ts.ts)
- #### [MODIFY] [interactor.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/interactor.ts)
- #### [MODIFY] [loader-hook.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/loader-hook.ts)
- #### [MODIFY] [loader-hook-esm.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/loader-hook-esm.ts)
- #### [MODIFY] [plugins.ts](file:///c:/Users/sunny/Desktop/abc_js2ts/src/plugins.ts)

## 驗證計畫
### 自動化測試
1. 在根目錄下執行 `pnpm run build` 進行編譯。
2. 確保沒有任何 TypeScript 型別宣告與編譯錯誤。

---
**時間戳記**：2026-06-07 14:08:00

## 全專案語境與記憶體原子交易落盤重構計畫

### 使用者審查要求
> [!IMPORTANT]
> 1. **全專案語境載入 (Whole-Project Context)**：
>    - 啟動時先將所有待轉換的 `.js` 檔案以虛擬 `.ts` 檔案形式載入至 `Project` 記憶體樹中，連同所有的 `*.d.ts` 宣告檔，維持在記憶體中以建立完整的專案依賴關係。
> 2. **單一全域 TypeChecker (Performance Caching)**：
>    - 僅在重構迴圈前呼叫一次 `project.getTypeChecker()`，並將 `typeChecker` 實例向下傳遞，最大化利用 TS Compiler 的快取效能。
> 3. **記憶體原子交易落盤 (Memory-based Transaction Commit)**：
>    - 在 AST 轉換過程中完全禁止任何磁碟寫入與刪除。重構完成後，在 Dry Run 模式下比對記憶體與磁碟產出 Diff；在寫入模式下一次性執行寫入（如 `project.save()` 或逐檔寫入）並批次刪除舊 JS 檔案。
> 4. **整合 `ts-query` 選擇器 (Clean Selector-based AST Queries)**：
>    - 在 `ast-refactorer.ts` 引入 `@phenomnomnominal/tsquery`，使用 CSS 選擇器簡化 `this.prop = val`、`require` 等繁瑣的節點搜尋邏輯，並透過 `sourceFile.getNodeFromCompilerNode(tsNode)` 包裝回 `ts-morph` 節點。

### 開放問題
無。

### 預期變更
- `package.json`
- `src/code-generator.ts`
- `src/ast-refactorer.ts`

### 驗證計畫
1. 執行 `pnpm install` 安裝新依賴。
2. 執行 `pnpm run build` 編譯 CLI 工具。
3. 對 `3_Snake` 專案執行 `--dry-run` 與實際 `generate` 驗證，確保代碼轉換無錯，且原本的 JS 檔被批次清除。

---

# 解決 TypeScript AST 遍歷與 Class 屬性提取 AST 重構缺陷

**時間戳記**：2026-06-07 15:00:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **解決 `ts-morph` 與 `tsquery` 版本衝突**：
>    - 由於 `ts-morph` 內嵌的 `typescript` (5.4.2) 與根目錄的 `typescript` (6.0.3) 實例不對等，導致 `tsquery` 在調用 `forEachChild` 遍歷 `ts-morph` AST 節點時傳回 0 個匹配。本變更將在 `ast-refactorer.ts` 引入 `tsquery` 之前，覆寫 `require.cache['typescript']` 以對齊實例。
> 2. **Node 類別原型擴充 (Prototype Extension)**：
>    - 將 `tsquery` 選擇器查詢功能以成員方法形式直接注入至 `ts-morph` 的 `Node.prototype.query(selector)`。
> 3. **動態 `ThisKeyword` 屬性提取**：
>    - 原本 `expression.name="this"` 無法在 AST 的 `ThisKeyword` 節點上匹配。本變更將選擇器改為 `expression.kind=${SyntaxKind.ThisKeyword}` 以精確選取成員屬性賦值，進而順利將建構子中的變數提取至 Class 欄位定義。

## 開放問題
無。

## 預期變更
- `src/ast-refactorer.ts`

## 驗證計畫
1. 執行 `pnpm run build` 編譯 CLI 工具。
2. 對 `3_Snake` 專案執行 `node dist/cli.js generate -i ./3_Snake -o ./3_SnakeTS -f`。
3. 檢查 `3_SnakeTS/src/engine/gameEngine.ts` 等 Class 的欄位宣告與 constructor 初始化語法，確保屬性順利提取宣告，原建構子賦值移除。

---

# 修正 AST 方法呼叫傳播選擇器與無效陣列型別標註

**時間戳記**：2026-06-07 19:30:00

## 使用者審查要求
> [!IMPORTANT]
> 1. **修正 `this` 方法呼叫之選擇器限制**：
>    - 原本 `expression.name="this"` 無法匹配 AST 中的 `ThisKeyword`。本變更將其改為 `expression.kind=${SyntaxKind.ThisKeyword}`，以使所有 class methods 內呼叫 `this.methodName(args)` 的引數型別能正確透過反向型別傳播注入到被呼叫方法的參數上。
> 2. **排除阻礙型別演進的無效陣列型別**：
>    - 針對 `var arr = []` 等變數初始化，TypeScript compiler 會推導其初階型別為 `undefined[]` 或 `never[]` 等。若將其寫入程式碼會阻礙陣列型別演進。本變更將在 `getCleanTypeText` 中將這些型別安全排除（返回空字串），由 TypeScript 自行進行 control-flow/array type evolution。

## 開放問題
無。

## 預期變更
- `src/ast-refactorer.ts`

## 驗證計畫
1. 執行 `pnpm run build` 編譯 CLI 工具。
2. 對 `4_abc662` 執行 `node dist/cli.js generate -i ./4_abc662 -o ./4_abcTS -f`。
3. 檢查 `4_abcTS/src/data/abc_tune.ts` 中 `computePickupLength` 及 `addEndPoints` 方法簽章與內部的局部變數，確保不再包含 `undefined[]` 或 `never[]` 等型別錯誤，而是正確對齊 `Lines[]` 與 `any[]`。
4. 於 `4_abcTS` 目錄執行 `pnpm install` 與 `pnpm run build:vite`，確認編譯 100% 無錯通過。
