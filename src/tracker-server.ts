import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

let typeDB: Record<string, any> = {};
let config: any = {};
let boundaryMap = { classes: {}, boundaries: [] };
let serverInstance: any = null;

/**
 * 載入先前已記錄儲存的 `types-observed.json`。
 * 
 * @description
 * 若檔案存在於執行目錄下，同步讀取並解析 JSON，
 * 載入至記憶體中的 `typeDB` 全域資料庫，以防覆寫覆蓋之前的側錄結果。
 * 
 * @returns {void} 本方法不回傳任何值。
 */
function loadExistingTypes() {
  const targetPath = path.resolve(process.cwd(), 'types-observed.json');
  if (fs.existsSync(targetPath)) {
    try {
      typeDB = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    } catch (e: any) {
      console.warn(chalk.yellow(`⚠ 讀取現有 types-observed.json 失敗: ${e.message}`));
    }
  }
}

/**
 * 將目前記憶體中收集合併的所有型別側錄寫回磁碟。
 * 
 * @description
 * 將全域變數 `typeDB` 序列化並同步寫入專案根目錄的 `types-observed.json`。
 * 若寫入失敗，在控制台輸出錯誤 Log。
 * 
 * @returns {void} 本方法不回傳任何值。
 */
function saveTypes() {
  const targetPath = path.resolve(process.cwd(), 'types-observed.json');
  try {
    fs.writeFileSync(targetPath, JSON.stringify(typeDB, null, 2), 'utf-8');
  } catch (e: any) {
    console.error(chalk.red(`❌ 寫入 types-observed.json 失敗: ${e.message}`));
  }
}

/**
 * 合併兩份 Call Graph 靜態/動態調用圖的權重次數。
 * 
 * @description
 * 當多個呼叫點重複執行時，對相同調用鏈的 `count` 進行累加，
 * 並將兩份 Map 聯集合併，用於在視覺化檢視時呈現真實頻率與依賴關係。
 * 
 * @param {any} existingGraph - 已有的 Call Graph 結構。
 * @param {any} newGraph - 新收集到的 Call Graph 結構。
 * @returns {any} 返回合併後的 Call Graph 結構。
 */
function mergeCallGraph(existingGraph: any, newGraph: any) {
  const result = { ...existingGraph };
  for (const [caller, callees] of Object.entries(newGraph)) {
    if (!result[caller]) {
      result[caller] = {};
    }
    for (const [callee, count] of Object.entries(callees as Record<string, number>)) {
      result[caller][callee] = (result[caller][callee] || 0) + count;
    }
  }
  return result;
}

/**
 * 將單筆偵測到的型別紀錄與記憶體中已有的記錄進行合併。
 * 
 * @description
 * 1. 若該 ID 為 `__callGraph`，呼叫 `mergeCallGraph` 對調用關係鏈進行累計。
 * 2. 針對一般型別記錄（如函數參數或欄位）：
 *    a. 累加呼叫次數 `callCount`。
 *    b. 合併 observedTypes 陣列並去重。
 *    c. 比對並合併 objectShapes 欄位字面量結構，避免重複寫入相同結構。
 * 
 * @param {string} id - 該型別側錄點的唯一識別碼（如 `filename::funcName::param::name`）。
 * @param {any} newRecord - 新產生的側錄資料結構。
 * @returns {void} 本方法不回傳任何值。
 */
function mergeRecord(id: string, newRecord: any) {
  if (id === '__callGraph') {
    typeDB['__callGraph'] = {
      graph: mergeCallGraph(typeDB['__callGraph']?.graph || {}, newRecord.graph || {})
    };
    return;
  }

  if (!typeDB[id]) {
    typeDB[id] = {
      observedTypes: [],
      objectShapes: [],
      callCount: 0
    };
  }

  const existing = typeDB[id];
  existing.callCount += (newRecord.callCount || 0);

  const typesSet = new Set([...(existing.observedTypes || []), ...(newRecord.observedTypes || [])]);
  existing.observedTypes = Array.from(typesSet);

  if (newRecord.objectShapes && newRecord.objectShapes.length > 0) {
    newRecord.objectShapes.forEach((newShape: any) => {
      const newShapeStr = JSON.stringify(newShape);
      const exists = (existing.objectShapes || []).some((s: any) => JSON.stringify(s) === newShapeStr);
      if (!exists) {
        if (!existing.objectShapes) existing.objectShapes = [];
        existing.objectShapes.push(newShape);
      }
    });
  }
}

/**
 * 啟動用於收集與存取執行期型別側錄資料的 HTTP Express 伺服器。
 * 
 * @description
 * 1. 初始化 `typeDB` 並讀取既有的 `types-observed.json`。
 * 2. 提供 `/tracker.js` GET 路由，動態編譯並注入埠號及排除配置後，提供給前端瀏覽器或 Node.js 客戶端下載。
 * 3. 提供 `/types` POST 路由，供執行期插樁程式將側錄到的型別資料（批量）傳送回伺服器進行 `mergeRecord` 與持久化。
 * 4. 提供 `/shutdown` POST 路由，供腳本執行完畢時遠端請求關閉伺服器。
 * 
 * @example
 * await startServer(9002, config);
 * 
 * @param {number} port - 伺服器欲監聽的埠號。
 * @param {any} runConfig - 來自主設定檔的執行期配置。
 * @returns {Promise<any>} 返回一個 Promise，解析後代表伺服器已成功啟動。
 */
export function startServer(port: number, runConfig: any): Promise<any> {
  config = runConfig || {};
  loadExistingTypes();

  const boundaryMapPath = path.resolve(process.cwd(), 'boundary-map.json');
  if (fs.existsSync(boundaryMapPath)) {
    try {
      boundaryMap = JSON.parse(fs.readFileSync(boundaryMapPath, 'utf-8'));
    } catch (e) {}
  }

  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  app.get('/tracker.js', (req, res) => {
    const clientPath = path.join(__dirname, 'tracker-client.js');
    if (fs.existsSync(clientPath)) {
      let clientCode = fs.readFileSync(clientPath, 'utf-8');
      clientCode = clientCode.replace('// __CONFIG_INJECTION_PLACEHOLDER__', `
        globalThis.__trackerPort = ${port};
        globalThis.__trackerConfig = ${JSON.stringify(config)};
      `);
      res.setHeader('Content-Type', 'application/javascript');
      res.send(clientCode);
    } else {
      res.status(404).send('Tracker client script not found.');
    }
  });

  app.post('/types', (req, res) => {
    const incomingDB = req.body || {};
    let count = 0;
    for (const [id, record] of Object.entries(incomingDB)) {
      mergeRecord(id, record);
      count++;
    }
    if (count > 0) {
      saveTypes();
    }
    res.json({ success: true, merged: count });
  });

  app.post('/shutdown', (req, res) => {
    res.json({ success: true });
    saveTypes();
    console.log(chalk.blue('🔌 收到關閉信號，正在儲存型別並關閉伺服器...'));
    if (serverInstance) {
      serverInstance.close();
    }
  });

  return new Promise((resolve) => {
    serverInstance = app.listen(port, () => {
      console.log(chalk.blue(`🚀 型別收集背景伺服器已啟動：http://localhost:${port}`));
      resolve(serverInstance);
    });
  });
}

/**
 * 關閉目前正在執行的型別收集 Express 伺服器。
 * 
 * @description
 * 若伺服器實例存在，停止監聽請求並在關閉前最後一次強制將記憶體的型別寫入磁碟。
 * 
 * @example
 * stopServer();
 * 
 * @returns {void} 本方法不回傳任何值。
 */
export function stopServer() {
  if (serverInstance) {
    serverInstance.close();
    saveTypes();
    console.log(chalk.blue('🔌 型別收集背景伺服器已關閉。'));
  }
}
