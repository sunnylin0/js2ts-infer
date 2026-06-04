## ai quest:

為了解決「動態側錄 File-Function 呼叫關係並生成 HTML/SVG 視覺化架構圖」的需求，在為你撰寫實作計畫（*.md）前，需要先與你確認以下 8 個核心設計與技術細節問題：

1. 連線記錄粒度 (Granularity)：
- 只需要呈現 檔案 A -> 檔案 B 的檔案級依賴？
- 還是要精確到 檔案 A 的 functionX -> 檔案 B 的 functionY 的函數級呼叫？
2. 非同步與間接呼叫的追蹤 (Async/Callback Call)：
- 當透過事件監聽器（Event Emitter）、setTimeout、Promise 或 Callback 進行間接呼叫時，是否需要追蹤其源頭？（這會涉及是否需要解析 Call Stack 或是透過 Async Context 傳遞關聯）。
3. 外部依賴與 Web API 過濾 (External Library/Built-in API)：
- 是否只記錄專案內部模組之間的呼叫關係？
- 還是需要記錄對第三方套件（如 lodash、vite）或瀏覽器原生 API（如 document.createElement）的呼叫？
4. 呼叫頻率與數據統計 (Call Count/Weight)：
- 重複的呼叫關係是否需要記錄呼叫次數（例如作為連線的粗細/權重指標）？還是僅記錄「有/無」連線即可？
5. 執行環境支援 (Runtime Environments)：
- 這個呼叫關係收集器是否需要同時支援瀏覽器前端（如 3_Snake，通常涉及使用者互動引發呼叫）與 Node.js 後端環境？
6. 視覺化圖表技術偏好 (Visualization Library)：
- HTML/SVG 範本部分，你是否有偏好的開源繪圖程式庫？例如 D3.js（力導向圖，適合大圖）、Mermaid.js（直接產生節點流程圖）、vis-network 或純手工用 SVG 渲染？
7. 靜態分析補足 (Static vs Dynamic)：
- 視覺化架構圖是否僅呈現「執行期實際被呼叫過」的線路？還是需要結合靜態 AST 分析，將「有定義但側錄期間沒被執行到」的潛在呼叫關係也用虛線呈現？
8. JSON 資料結構格式 (JSON Schema)：
- 呼叫關係資料是要與現有的 types-observed.json 合併（在裡面增加 calls 欄位），還是產生一個獨立的 JSON 檔案（例如 call-graph.json）？

## user answer:
1. 2 個都要，可以勾選要不要顯示
2. 需要追蹤。
3. 只需要記錄專案內部模組之間的呼叫關係
4. 記錄呼叫次數
5. 需要
6. 我需要可以手動移動物件位置的 svg 工具流程圖
7. 也需要潛在呼叫關係
8. 現有的 types-observed.json 合併