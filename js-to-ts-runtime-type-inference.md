# 完整系統規劃：JS → TS 執行時期型別輔助轉換工具

---

## 系統定位

- **前後端都支援**：瀏覽器端用插樁 JS，Node.js 端用插樁 + 攔截
- **收集方式**：手動操作 + 自動化測試兩種管道並行
- **目標品質**：產生有意義的 `interface`，大幅減少 `any`
- **規模**：小型、中大型、超大型專案 > 30,000 行，需要分模組處理
- **使用方式**：npm 樣式 CLI 工具，透過 `npx js2ts-infer <command>` 進行分析、動態攔截、型別生成與互動式審閱

---

## 整體流程總覽

本系統提供兩種執行模式，建議大型專案採用 **「無侵入式混合流 (方案 B)」**：

### 方案 A：全量 AST 插樁流（傳統）
```
原始 JS 專案 ──> [Step 1: AST 分析地圖] ──> [Step 2: 寫入插樁代碼] ──> [Step 3: 執行期側錄] ──> [Step 4: AST 寫回型別]
```

### 方案 B：無侵入式混合流 (Dynamic Proxy + Static Flow) 🌟【推薦】
```
原始 JS 專案 ──> [Step 1: Static Flow 靜態掃描與邊界識別]
                      │
                      ▼ (產生 exports 與 API 監聽清單，檔案完全不修改)
                [Step 2: Loader 掛載 Dynamic Proxy 攔截器]
                      │
                      ▼ (跑測試或手動操作，側錄流入/流出的邊界型別)
                [Step 3: 邊界型別反向傳播 (Static Propagation)]
                      │
                      ▼ (將邊界型別做為已知解，推導函式內部變數型別)
                [Step 4: TS 程式碼生成與驗證]
```

---


## Step 1：靜態分析（AST 掃描）

### 目的
在插樁前先了解整個專案結構，建立「插樁地圖」，知道哪裡要插、哪裡不需要。

### 要分析的節點類型

| 節點類型 | 需要側錄的資訊 |
|----------|--------------|
| 函式宣告 / 箭頭函式 | 每個參數的型別、回傳值型別 |
| 變數宣告 `var/let/const` | 賦值當下的型別 |
| Class 屬性與方法 | 屬性型別、方法參數與回傳 |
| 物件字面量 `{}` | 每個 key 的型別（遞迴） |
| Array | 元素型別的聯集 |
| 函式呼叫的回傳值 | 被接收的那一刻的型別 |
| API 回應（fetch/axios） | response.json() 的結構 |
| 事件處理器 | event 參數的型別 |
| Callback 參數 | 傳入 callback 的型別 |

### 不需插樁的地方
- 純數學運算（`a + b` 本身不用追蹤）
- 已有型別可推斷的常數（`const PI = 3.14`）
- 第三方套件呼叫（有 `@types` 定義）
- 字串模板

### 輸出產物
一份 **插樁地圖 JSON**，記錄每個檔案的每個節點位置與插樁類型，供 Step 2 使用。

---

## Step 2：插樁處理

### 前端插樁策略

插樁器讀取插樁地圖，用 Babel AST transform 在原始碼對應位置注入側錄呼叫。

#### 1. 程式碼插樁對比範例

**原始 JS 代碼**：
```javascript
function processUser(user, options) {
  let rate = options.rate || 0.1;
  return user.score * rate;
}
```

**AST 插樁後 JS 代碼**：
```javascript
function processUser(user, options) {
  // 1. 函式入口：側錄所有參數
  globalThis.__typeTracker("src/user.js::processUser::param::user", user);
  globalThis.__typeTracker("src/user.js::processUser::param::options", options);

  let rate = options.rate || 0.1;
  // 2. 變數賦值：側錄變數型別
  globalThis.__typeTracker("src/user.js::processUser::var::rate", rate);

  const _result = user.score * rate;
  // 3. 函式出口：側錄回傳值
  globalThis.__typeTracker("src/user.js::processUser::return", _result);
  return _result;
}
```

#### 2. 核心側錄器 `__typeTracker` 實作程式碼

側錄器必須在瀏覽器/Node.js 全域環境下註冊，用以遞迴解析變數型別，其核心邏輯如下：

```javascript
const typeDB = {}; // 記憶體暫存型別庫

function serializeType(val, depth = 0, maxDepth = 5) {
  if (val === null) return "null";
  if (val === undefined) return "undefined";
  
  const basicType = typeof val;
  if (basicType !== "object" && basicType !== "function") {
    return basicType; // string, number, boolean, symbol, bigint
  }

  // 避免極端深層巢狀或循環引用
  if (depth > maxDepth) return "any"; 

  // 處理陣列
  if (Array.isArray(val)) {
    if (val.length === 0) return "Array<any>";
    // 採樣前 10 個元素的型別取聯集
    const elementTypes = new Set();
    val.slice(0, 10).forEach(item => {
      elementTypes.add(serializeType(item, depth + 1, maxDepth));
    });
    return `Array<${Array.from(elementTypes).join(" | ")}>`;
  }

  // 處理 Promise 非同步
  if (val instanceof Promise || (val && typeof val.then === "function")) {
    return "Promise<any>"; // 真正的 resolve 型別需要透過 .then() 異步側錄，此處打底為 Promise
  }

  // 處理 Class 實例 (例如 Date, HTMLElement)
  if (val.constructor && val.constructor.name !== "Object") {
    return val.constructor.name; 
  }

  // 處理普通物件字面量 (Plain Object) -> 遞迴抓取 Shape
  const shape = {};
  for (const key of Object.keys(val)) {
    shape[key] = serializeType(val[key], depth + 1, maxDepth);
  }
  return shape;
}

globalThis.__typeTracker = function (trackerId, value) {
  // 初始化該節點的型別紀錄
  if (!typeDB[trackerId]) {
    typeDB[trackerId] = {
      observedTypes: new Set(), // 儲存基本型別與 Class 名稱
      objectShapes: [],        // 儲存複雜物件的結構 shape (JSON-like)
      callCount: 0
    };
  }

  const record = typeDB[trackerId];
  record.callCount++;

  // 當同一個追蹤點側錄超過 100 次，且型別已趨於穩定，則略過解析以提升效能
  if (record.callCount > 100 && record.observedTypes.size > 0 && record.callCount % 10 !== 0) {
    return;
  }

  const serialized = serializeType(value);

  if (typeof serialized === "object") {
    // 序列化為 Shape 字串進行去重比對
    const shapeStr = JSON.stringify(serialized);
    const exists = record.objectShapes.some(s => JSON.stringify(s) === shapeStr);
    if (!exists) {
      record.objectShapes.push(serialized);
    }
  } else {
    record.observedTypes.add(serialized);
  }
};

// 匯出 JSON 方法
globalThis.__exportTypes = function () {
  const exportDB = {};
  for (const [id, data] of Object.entries(typeDB)) {
    exportDB[id] = {
      observedTypes: Array.from(data.observedTypes),
      objectShapes: data.objectShapes,
      callCount: data.callCount
    };
  }
  return JSON.stringify(exportDB, null, 2);
};
```

#### 3. 側錄產出 JSON 格式定義 (Schema)

執行測試或手動操作後，調用 `__exportTypes()` 會產生如下格式的 JSON 檔案：

```json
{
  "src/user.js::processUser::param::user": {
    "observedTypes": [],
    "objectShapes": [
      {
        "id": "string",
        "score": "number",
        "isActive": "boolean"
      }
    ],
    "callCount": 42
  },
  "src/user.js::processUser::param::options": {
    "observedTypes": [
      "undefined"
    ],
    "objectShapes": [
      {
        "rate": "number"
      }
    ],
    "callCount": 42
  },
  "src/user.js::processUser::var::rate": {
    "observedTypes": [
      "number"
    ],
    "objectShapes": [],
    "callCount": 42
  },
  "src/user.js::processUser::return": {
    "observedTypes": [
      "number"
    ],
    "objectShapes": [],
    "callCount": 42
  }
}
```

#### 4. 特殊型別的追蹤策略

- **非同步 Promise**：若遇到 `Promise`，側錄器除了記錄其為 `Promise` 外，還會透過 `value.then(resolvedVal => __typeTracker(trackerId + "::resolved", resolvedVal))` 動態追蹤非同步 resolve 後的實際型別。
- **回呼函式 (Callback)**：為了能追蹤 Callback 的入參與回傳型別，插樁代碼必須採用 **「賦值重寫 (Reassignment)」** 模式，並在側錄器中實作包裝代理。

##### 1. 插樁程式碼改寫 (AST Rewrite)
```javascript
// 原始代碼：processUser(user, callback)
// 插樁代碼：將側錄器回傳的 wrapped function 重新賦值給 callback 變數
callback = globalThis.__typeTracker("src/user.js::processUser::param::callback", callback);
```

##### 2. 側錄器內的代理實作
當 `__typeTracker` 接收到的 `value` 是 `function` 時，它會回傳一個 Wrapped Function，並在內部監聽其執行過程：
```javascript
if (typeof value === "function") {
  if (value.__isWrapped) return value; // 避免重複包裹

  const originalFn = value;
  const wrappedFn = function (...args) {
    // A. 側錄 Callback 被呼叫時傳入的參數型別 (如第 0、1 個參數)
    args.forEach((arg, index) => {
      globalThis.__typeTracker(`${trackerId}::cb_param::${index}`, arg);
          });
          
    // B. 執行原本的 Callback
    const result = originalFn.apply(this, args);
          
    // C. 側錄 Callback 執行後的回傳值型別
    globalThis.__typeTracker(`${trackerId}::cb_return`, result);

          return result;
        };

  Object.defineProperty(wrappedFn, "__isWrapped", { value: true, enumerable: false });
  Object.assign(wrappedFn, originalFn); // 複製原函數之屬性
  return wrappedFn; // 傳回代理函數
}
```
##### 3. 產生的型別 JSON 結構
這會自動在資料庫產生關聯的子 Tracking 欄位：
- `...::callback::cb_param::0` (側錄第 1 個參數)
- `...::callback::cb_return` (側錄 Callback 的回傳值)


#### 5. 前端打包工具整合 (Vite & Webpack)

為了在前端瀏覽器端能自動完成動態側錄，我們可以將 Babel 插樁邏輯寫成 **Vite Plugin** 或 **Webpack Loader**。

##### A. Vite 插件實作
Vite 開發階段基於原生 ESM，我們可以在 `transform` hook 中攔截 `.js` 檔案，透過 Babel AST 轉換後將插樁代碼傳回給 Vite：

```javascript
// vite-plugin-js2ts-infer.js
import { transformSync } from '@babel/core';
import customBabelPlugin from './babel-plugin-js2ts.js'; // 你的 AST 插樁插件

export default function js2tsInferPlugin() {
  return {
    name: 'vite-plugin-js2ts-infer',
    // 限制只在開發模式 (dev server) 或跑測試時啟用插樁
    apply: 'serve', 
    transform(code, id) {
      // 排除 node_modules 與測試檔
      if (id.includes('node_modules') || !id.endsWith('.js')) {
        return null;
      }

      const result = transformSync(code, {
        filename: id,
        plugins: [customBabelPlugin],
        sourceMaps: true, // 保持 Source Map 確保除錯行號不偏移
      });

      return {
        code: result.code,
        map: result.map
      };
    }
  };
}
```

##### B. Webpack Loader 實作
如果你的專案使用 Webpack (如舊版的 React/Vue 或 abcjs 本身)，可透過編寫自訂 Loader 處理：

```javascript
// loaders/js2ts-loader.js
const { transformSync } = require('@babel/core');
const customBabelPlugin = require('./babel-plugin-js2ts.js');

module.exports = function (source, map, meta) {
  // 排除第三方套件
  if (this.resourcePath.includes('node_modules')) {
    return this.callback(null, source, map, meta);
  }

  try {
    const result = transformSync(source, {
      filename: this.resourcePath,
      plugins: [customBabelPlugin],
      inputSourceMap: map, // 連接前一個 loader 的 source map
      sourceMaps: true,
    });

    this.callback(null, result.code, result.map, meta);
  } catch (err) {
    this.emitError(err);
    this.callback(err, source, map, meta);
  }
};
```
在 `webpack.config.js` 配置：
```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          { loader: path.resolve(__dirname, './loaders/js2ts-loader.js') }
        ]
      }
    ]
  }
};
```

### Node.js 後端插樁策略

- 用 `require hook` 或 ES Module loader hook 攔截，不需修改原始碼
- 自動偵測 Express/Koa/Fastify 等框架，對 route handler 的 `req`、`res` 做額外深度追蹤
- 搭配自動化測試（Playwright/Cypress）跑過主要流程後，輸出型別資料 JSON

### 插樁版本管理
- 插樁版 JS 與原始 JS **分開存放**，不污染原始碼
- 插樁 ID 與原始碼行號對應，確保型別資料能對回原始碼正確位置

---

## Step 3：型別資料庫與合併

這是整個系統最核心的部分。

### 資料結構設計

每一個「追蹤點」對應一筆記錄：

```json
{
  "id": "src/utils/format.js::formatDate::param::date",
  "observedTypes": ["string", "Date", "number"],
  "objectShapes": [
    { "year": "number", "month": "number" },
    { "year": "number", "month": "number", "day": "number" }
  ],
  "callCount": 342,
  "nullable": true
}
```

### 型別合併規則

#### 基本型別合併
- 多種基本型別 → Union Type：`string | number`
- 出現 `null` 或 `undefined` → 加上 `| null` 或 `| undefined`，或標記為 optional

#### 物件 Shape 合併
- 多次觀察到的物件 shape 取聯集
- 某個 key 不是每次都出現 → 標記為 `optional`（加 `?`）
- 同一個 key 在不同次觀察有不同型別 → 該 key 用 Union Type

#### Array 合併
- 收集所有觀察到的元素型別取聯集
- `[1, "a", true]` → `Array<number | string | boolean>`
- 若元素都是相同 shape 的物件 → 產生對應 interface

#### 巢狀物件處理
- 遞迴合併，每層獨立處理
- 相同 shape 的物件出現超過閾值次數 → 自動命名並提升為獨立 `interface`

#### interface 自動命名策略
- 根據使用位置命名：`formatDate` 函式的 `options` 參數 → `FormatDateOptions`
- API response → `FetchUserResponse`
- 無法推斷時 → `Shape_001`（後續透過互動式 CLI 審閱改名）

### 兩端資料合併
- 瀏覽器端匯出的 JSON + Node.js 端匯出的 JSON
- 透過 `js2ts-infer merge` 指令自動合併，並輸出衝突報告與統計
- 衝突時（同一個位置兩端觀察到不同型別）→ 取聯集，並在終端機或報告檔案中標記

---

## Step 4：TypeScript 程式碼生成

### 生成策略

#### 第一輪：確信度高的自動生成
- 觀察次數多、型別穩定（沒有 Union）→ 直接注入確定型別
- 例：某函式被呼叫 500 次，參數永遠是 `number` → 直接標 `number`

#### 第二輪：中等確信度
- 有 Union Type 但組合簡單（`string | null`）→ 自動生成
- 物件 shape 在合併後穩定 → 生成 interface

#### 第三輪：低確信度保留標記
- 觀察次數太少（< 5 次）→ 生成 `/* @inferred-low-confidence */ any`
- 型別組合太複雜（超過 4 種 Union）→ 保留 `any` 並在報告中列出

### AST 注入方式
- 用 ts-morph 操作 TypeScript AST
- 保留原始碼所有格式、註解、空行（非暴力替換，精確插入型別標注）
- 自動在檔案頂部加入需要的 `import type` 語句
- 生成的 interface 統一放入 `types/` 資料夾，各自對應模組

### 大型專案的分批處理
- 超過 30,000 行的專案按**模組/資料夾**分批轉換
- 每批處理完後可預覽，確認無誤再繼續
- 模組間的型別依賴自動解析（A 模組用到 B 模組的型別）

---

## Step 5：驗證與後處理

### 自動驗證
- 跑 `tsc --noEmit` 確認生成的 TS 可編譯
- 掃描剩餘的 `any` 數量，與轉換前比較
- 產生品質報告：any 減少率、interface 數量、低確信度標記數量

### 互動式 CLI 審閱與補完功能
- 執行 `npx js2ts-infer review`，在終端機提供互動式選單。
- 尋找專案中剩餘的 `any`，並在終端機渲染程式碼上下文（Context）。
- 顯示該節點在執行期側錄到的候選型別（如 `string | number`），讓使用者直接透過鍵盤上下鍵選擇並即時更新。

---

## CLI 命令行指令設計

本工具包名為 `js2ts-infer`，採用 npm 樣式指令：

### 1. 初始化專案配置
```bash
npx js2ts-infer init
```
- 在專案目錄產生 `js2ts.config.json`，配置排除路徑、側錄深度限制、自動提升為 interface 的閾值。

### 2. 靜態分析與邊界掃描 (Static Flow)
```bash
npx js2ts-infer scan [options]
```
- 掃描 JS AST，找出所有 `export` 邊界、API 呼叫點與能靜態推導的型別。
- 輸出 `boundary-map.json`（邊界圖譜）。

### 3. 無侵入式執行期側錄 (Dynamic Proxy)
```bash
npx js2ts-infer run <test-command>
```
- **範例**：`npx js2ts-infer run "npm run test"` 或 `npx js2ts-infer run "node app.js"`
- **原理**：自動載入 ESM/CommonJS Hook，執行測試或啟動應用，將 Proxy 收集到的傳入/傳出型別自動寫入 `types-observed.json`。

### 4. 合併多端型別資料庫
```bash
npx js2ts-infer merge <files...>
```
- **範例**：`npx js2ts-infer merge browser-types.json node-types.json --out merged-types.json`
- 合併多個 JSON，處理聯集型別，並於終端機輸出衝突比對報告。

### 5. 型別傳播與程式碼注入
```bash
npx js2ts-infer generate [options]
```
- 執行型別雙向傳播，以 `merged-types.json` 的邊界型別為基礎推導內部型別，最後用 `ts-morph` 精確寫入程式碼。

### 6. 互動式剩餘 any 審閱
```bash
npx js2ts-infer review
```
- 於終端機啟動互動式 Review 介面，逐個檔案確認 `any` 補完與 `interface` 的命名。

---

## 關鍵技術選型

| 模組 | 技術 |
|------|------|
| **AST 解析與靜態掃描** | `@babel/parser` + `@babel/traverse` |
| **TS 型別注入** | `ts-morph` |
| **Node.js 邊界攔截** | `pirates` (CJS Hook) + Node ESM Loader Hook |
| **CLI 核心框架** | `commander` 或 `cac` (處理子指令與 args) |
| **終端互動介面 (Interactive CLI)** | `inquirer` 或 `prompts` (選單、輸入) |
| **終端文字美化** | `chalk` (顏色) + `ora` (進度 Spinner) + `cardinal` (代碼高亮) |
| **本地型別資料庫** | 輕量級 `lowdb` 或直接寫入 JSON 檔 |

---

## 關鍵挑戰與對策

| 挑戰 | 對策 |
|------|------|
| 覆蓋率不足（沒跑到的 code path） | 搭配自動化測試提高覆蓋率；低覆蓋位置標記 `any` 並提示人工補完 |
| 物件 shape 遞迴巢狀 | 深度限制 + 循環引用偵測 |
| 泛型推斷 | 跨呼叫分析，歸納 `Array<T>` 的 T |
| 閉包 scope 追蹤 | 插樁 ID 包含 scope 路徑，確保同名變數在不同 scope 分開記錄 |
| 大型專案效能 | 靜態分析 + 記憶體 Proxy 邊界側錄（避免磁碟讀寫與大規模代碼變更） |

---

## 核心系統設計決策 (Core Architectural Decisions)

以下為本工具開發與執行的核心規範與設計決策：

1. **瀏覽器端回收機制**：`js2ts-infer` CLI 會在背景啟動一個臨時的 **HTTP Receiver Server**。插樁版網頁代碼在執行期或 `beforeunload` 時，會以 POST 請求將 `window.__typeDB` 自動回傳至該 Server 進行存檔。
2. **型別合併策略**：採用 **增量合併 (Upsert)**。新收集到的型別資料會與本地已有的 `types-observed.json` 比對並累加，不會直接覆蓋舊紀錄，確保多單元測試或不同操作流程的型別能完整保留。
3. **型別寬度判定**：字串與數字等基礎型別一律推導為**寬鬆型別**（例如 `string`、`number`），不進行字面量聯集（Literal Union）推導，以確保生成的型別具備通用性，減少因測試覆蓋值有限而造成的型別過載。
4. **Class 定義地圖**：在靜態分析（Step 1）階段，工具會自動掃描全專案，建立 **「Class 定義路徑地圖 JSON」**。在 TS 生成階段，工具能依此地圖在檔案頂部自動補上精確的 `import type { ClassName } from './path'`。
5. **JSDoc 與舊註解處理**：不讀取現有的 JSDoc 型別。現有 JS 程式碼中的 JSDoc 與普通註解一律**原樣保留**，不進行清除，避免人工編寫的語意註解丟失。
6. **模組系統轉換**：在最終生成 TS 時，工具會**自動將所有的 CommonJS 語法（`require`、`module.exports`）轉換為標準 ESM（`import`、`export`）**，達成現代化 TS 專案規範。
7. **泛型推導規劃**：初期僅進行**簡單的型別聯集推導**，暫不實作複雜的泛型推論（Generics Inference），優先確保基本型別與 Interface 的生成品質。
8. **程式碼修改安全防護**：
   - 執行 `generate` 前，CLI 會自動檢查 Git 狀態。若工作區有未提交的修改，會拒絕執行並提示提交，除非加上 `--force` 旗標。
   - 支援 `--dry-run` 模式，該模式下不會修改任何檔案，而是利用 `diff` 模組在終端機輸出詳細的 Diff Log，供開發者預覽。
