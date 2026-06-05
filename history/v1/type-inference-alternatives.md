# JS 轉 TS 運行時型別推導：替代技術方案評估

除了傳統的 **AST 解析與插樁（AST Instrumentation）** 之外，還有以下五種核心技術可以用於 JS 到 TS 的型別偵測與轉換：

---

## 1. V8 引擎級別的 JIT 型別回饋 (Inline Caches / Type Feedback)

### 原理
V8 等 JS 引擎在執行 JS 時，為了進行 JIT 優化，內部會透過 **Inline Caches (IC)** 和 **Feedback Vectors** 來記錄變數與函式的型別變化（如 Monomorphic、Polymorphic 等 Map 狀態）。我們可以直接讀取引擎內部的型別追蹤資訊，不需在原始碼中插入任何側錄函式。

### 實現方式
- 使用 Node.js 啟動旗標（如 `node --trace-ic` 或 `node --trace-deopt`）生成執行日誌，再利用分析工具（如 `v8-deopt-viewer`）解析日誌以獲得型別資訊。
- 使用 Node.js 的 `--allow-natives-syntax` 執行旗標，在代碼中透過 V8 的 Native 語法（例如 `%HaveSameMap` 或 `%DebugPrint`）來獲取物件的 Map (Shape)。

### 優缺點
*   **優點**：效能開銷極低，對執行期的干擾近乎為零，不需要修改原始碼，亦不需處理 Source Map 的映射問題。
*   **缺點**：V8 的內部 Map/IC 結構較為低階且多變，不易直接映射回 TypeScript 的 High-level Interface，且強烈依賴引擎實現（非跨平台）。

---

## 2. Chrome DevTools Protocol (CDP) / Inspector 斷點監聽 (Debugger-based Trace)

### 原理
利用 V8 Inspector API 或是 CDP（Chrome DevTools Protocol），在執行程式時以 Debugger 身份介入。不需要修改原始碼檔案，而是利用 **Source Maps** 直接在 V8 runtime 中「動態設置斷點（Breakpoint / Tracepoint）」，當程式跑到特定 AST 節點對應的行號時觸發中斷，讀取當下的 Scope 變數型別。

### 實現方式
```javascript
const inspector = require('inspector');
const session = new inspector.Session();
session.connect();

// 監聽 Debugger 暫停事件
session.on('Debugger.paused', (message) => {
  const callFrames = message.params.callFrames;
  const localScope = callFrames[0].scopeChain.find(s => s.type === 'local');
  
  // 透過 CDP 獲取該 Scope 下所有變數的 runtime 型別資訊
  session.post('Runtime.getProperties', { objectId: localScope.object.objectId }, (err, res) => {
    console.log(res.result); // 輸出屬性與型別
  });
});

session.post('Debugger.enable');
```

### 優缺點
*   **優點**：原始碼完全不變，甚至可以在 Production 或 Test 環境下直接掛載（Attach）監聽；型別精確度高。
*   **缺點**：每次斷點暫停與序列化物件的 IPC 通訊成本極高，會嚴重拖慢程式執行速度。

---

## 3. Dynamic Proxy & Monkey Patching (動態代理與模組邊界攔截)

### 原理
不用 AST 分析每一行程式碼，只攔截「系統邊界」（例如 Module 導出、Global API、網路請求、DB 驅動）。透過覆寫 `require`/ESM Loader 或將導出的模組物件封裝進 `Proxy` 中，動態側錄與該模組互動的所有傳入/傳出參數。

### 實現方式
```javascript
function createTypeTrackerProxy(target, moduleName, path = '') {
  return new Proxy(target, {
    get(obj, prop) {
      const val = Reflect.get(obj, prop);
      const currentPath = path ? `${path}.${prop}` : prop;
      
      console.log(`[Access] ${moduleName}.${currentPath} - Type: ${typeof val}`);
      
      if (typeof val === 'function') {
        return function(...args) {
          // 側錄傳入參數型別
          console.log(`[Call] ${moduleName}.${currentPath} args:`, args.map(a => typeof a));
          const result = val.apply(this, args);
          // 側錄回傳值型別
          console.log(`[Return] ${moduleName}.${currentPath} result:`, typeof result);
          return result;
        };
      }
      
      if (val !== null && typeof val === 'object') {
        return createTypeTrackerProxy(val, moduleName, currentPath);
      }
      return val;
    }
  });
}
```

### 優缺點
*   **優點**：非常輕量，不需要做複雜的 AST 插樁與重構，僅追蹤「對外 API 介面」效果極佳。
*   **缺點**：無法追蹤模組內部的私有變數和局部函數的型別。

---

## 4. 靜態控制流與型別約束推導 (Static Data Flow & Constraint Solving)

### 原理
不實際執行程式，改以靜態分析器模擬所有可能的執行路徑，透過 **型別傳播 (Type Propagation)** 和 **約束求解 (Constraint Solving)** 來推導型別。

### 實現方式
- 使用 `Tern.js`、`Facebook Flow` 或者是 TypeScript 自帶的 `ts.TypeChecker` API (透過 `checkJs` 選項)。
- 利用數據流分析（Data Flow Analysis）追蹤變數的宣告、傳遞與呼叫，反向推導前置條件的型別。

### 優缺點
*   **優點**：不需執行環境，無安全性疑慮，也不受測試覆蓋率限制。
*   **缺點**：對於動態性極強的 JS 代碼（例如動態物件屬性拼裝、動態 class 繼承），靜態推導容易退化為 `any`。

---

## 5. Machine Learning / LLM 型別預測 (機器學習與大模型推斷)

### 原理
利用預訓練模型（如 CodeGen、DeepSeek-Coder 等），根據代碼命名風格、JSDoc 註解、上下文語意、第三方套件的已知型別，直接預測最可能的 TypeScript 宣告。

### 實現方式
- 使用基於圖神經網路 (GNN) 的型別推導工具（如 TypeWriter）。
- 將 JS 代碼切片輸入大模型，結合既有的部分型別定義，直接產出 TS interfaces。

### 優缺點
*   **優點**：可以猜出符合人類語意的名稱（如 `User`、`Config` ），而不是枯燥的自動生成 `Shape_001`。
*   **缺點**：可能存在幻覺（Hallucination），生成的型別不保證 100% 符合實際運行狀況。

---

## 總結：不同技術的場景選擇

1. **核心業務邏輯與內部輔助函數**：適合用 **AST 解析與插樁**，因為需要最精確的局部型別覆蓋。
2. **第三方程式庫與對外模組介面**：適合用 **Dynamic Proxy**，對現有系統零侵入且效率最高。
3. **無測試案例的大型舊專案**：適合先用 **靜態推導 + LLM 預測** 打底，生成大部分的型別基礎，再用 AST 進行動態修正。
