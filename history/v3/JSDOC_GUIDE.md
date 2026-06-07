## 📝 團隊開發規範：Function 頂級提示詞 (JSDoc/TSDoc) 撰寫指南

本文件定義了專案中 Function 註解的撰寫標準。優質的頂級提示詞註解可以讓開發者無需閱讀程式碼細節即可理解其職責，並能讓 VS Code 等編輯器自動生成完美的懸停提示字卡。

### 📌 頂級註解「黃金五部曲」公式

一個標準的頂級註解應包含以下五個核心區塊（請依序撰寫）：

1. 一句話總結 (Summary)：用命令式句型（如：建立、更新、計算）說明 Function 做什麼。
2. 詳細說明 (Description)：補充複雜的業務邏輯、演算法或邊界情況（選填）。
3. 參數說明 (@param)：列出所有輸入值，標明型別、名稱與含意。
4. 回傳值說明 (@returns)：說明輸出資料的型別與代表意義。
5. 例外與副作用 (@throws/@example)：標註潛在錯誤或提供使用範例。

### 💻 實戰範例模板

範例一：無參數、無回傳值的狀態重設（以 Tune.ts 為例）
```typescript
/**
 * 將樂曲（Tune）實例的所有狀態重設為初始預設值。
 * * @description
 * 此方法會清空所有快取、樂譜行（lines）以及元資料（metaText），
 * 並將環境參數恢復為預設的畫面顯示模式（screen）。
 * 通常在重新載入新 ABC 樂譜或切換歌曲時調用，以防止舊歌曲的資料殘留污染新樂譜。
 * * @example
 * const tune = new Tune();
 * tune.lines.push(currentLine);
 * // 切換歌曲時
 * tune.reset(); 
 * * @returns {void} 本方法不回傳任何值。
 */
function reset(): void {
    // 實作程式碼...
}
```
範例二：含複雜邏輯、非同步與錯誤處理的 Function

```TypeScript
/**
 * 根據歌曲 ID 與時間戳記，計算該時間點的音符點擊精準度（Accuracy）。
 * * @param {string} trackId - 目標音軌的唯一識別碼（UUID 格式）。
 * @param {number} timestamp - 毫秒級的時間戳記，必須大於等於 0。
 * @param {any[]} [selectedNotes] - 可選。使用者當前選取的音符陣列，若不傳則預設計算全音軌。
 * * @returns {Promise<number>} 回傳一個 Promise，解析後為 0 到 100 之間的百分比小數。
 * * @throws {NotFoundError} 當傳入的 `trackId` 在資料庫中找不到時拋出。
 * @throws {RangeError} 當 `timestamp` 為負數時拋出。
 * * @see {@link https://api.example.com/docs/accuracy | 命中率計算公式官方文件}
 */
async function calculateHitAccuracy(trackId: string, timestamp: number, selectedNotes?: any[]): Promise<number> {
    // 實作程式碼...
}
```
⚡ 撰寫頂級提示詞的 4 大高階心法
1. 使用「祈使句」開頭
- ❌ 不推薦：// 這個 function 主要是用來建立預設值的
- 推薦：/ 建立並回傳符合 MetaText 介面的完整初始預設值。 */

2. 善用 Markdown 語法
在 / ... */ 區塊內，完全支援 Markdown 語法：
- 使用反引號包裹變數名或代碼，例如：`trackId`。
- 使用 * 或 - 建立無序清單。

3. 拒絕廢話註解
不要重複 Function 名字已經表達得清清楚楚的事情，要描述「為什麼」或「隱藏的副作用」。
- ❌ 廢話：/ 設定標題 */ function setTitle(title: string)
- 頂級提示：/ 更新樂曲的顯示標題。注意：此操作會同步觸發 DOM 重新渲染，請避免在迴圈中高頻率調用。 */

4. 善用 IDE 自動生成
在編輯器中，於 Function 的正上方輸入 / 並按下 Enter，編輯器會自動補齊 @param 與 @returns 骨架，開發者只需負責填空。

🛠️ 快速複製專用空白模板
開發時可以直接複製以下空白結構至程式碼中：

```TypeScript
/**
 * [請在這裡用一句話寫下 Function 的核心功能]
 * * @description
 * [可選：在這裡詳細說明複雜的業務邏輯、特殊算法或邊界條件]
 * * @example
 * // [可選：簡單示範如何呼叫這個 Function]
 * const result = myFunction();
 * * @param {型別} 參數名稱 - [參數說明]
 * @param {型別} [選填參數名稱] - [選填參數說明]
 * * @returns {型別} [回傳值說明]
 * @throws {錯誤型別} [什麼情況下會噴這個錯]
 */
```