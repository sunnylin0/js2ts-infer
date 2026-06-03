const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

let typeDB = {};
let config = {};
let boundaryMap = { classes: {}, boundaries: [] };
let serverInstance = null;

function loadExistingTypes() {
  const targetPath = path.resolve(process.cwd(), 'types-observed.json');
  if (fs.existsSync(targetPath)) {
    try {
      typeDB = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    } catch (e) {
      console.warn(chalk.yellow(`⚠ 讀取現有 types-observed.json 失敗: ${e.message}`));
    }
  }
}

function saveTypes() {
  const targetPath = path.resolve(process.cwd(), 'types-observed.json');
  try {
    fs.writeFileSync(targetPath, JSON.stringify(typeDB, null, 2), 'utf-8');
  } catch (e) {
    console.error(chalk.red(`❌ 寫入 types-observed.json 失敗: ${e.message}`));
  }
}

// 增量合併單個 record
function mergeRecord(id, newRecord) {
  if (!typeDB[id]) {
    typeDB[id] = {
      observedTypes: [],
      objectShapes: [],
      callCount: 0
    };
  }

  const existing = typeDB[id];
  existing.callCount += (newRecord.callCount || 0);

  // 合併 observedTypes (基本型別與 Class 名稱)
  const typesSet = new Set([...(existing.observedTypes || []), ...(newRecord.observedTypes || [])]);
  existing.observedTypes = Array.from(typesSet);

  // 合併 objectShapes
  if (newRecord.objectShapes && newRecord.objectShapes.length > 0) {
    newRecord.objectShapes.forEach(newShape => {
      const newShapeStr = JSON.stringify(newShape);
      const exists = (existing.objectShapes || []).some(s => JSON.stringify(s) === newShapeStr);
      if (!exists) {
        if (!existing.objectShapes) existing.objectShapes = [];
        existing.objectShapes.push(newShape);
      }
    });
  }
}

function startServer(port, runConfig) {
  config = runConfig || {};
  loadExistingTypes();

  // 載入邊界地圖以便有些地方可以比對
  const boundaryMapPath = path.resolve(process.cwd(), 'boundary-map.json');
  if (fs.existsSync(boundaryMapPath)) {
    try {
      boundaryMap = JSON.parse(fs.readFileSync(boundaryMapPath, 'utf-8'));
    } catch (e) {}
  }

  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  // 提供給瀏覽器端的 tracker.js 腳本
  app.get('/tracker.js', (req, res) => {
    const clientPath = path.join(__dirname, 'tracker-client.js');
    if (fs.existsSync(clientPath)) {
      let clientCode = fs.readFileSync(clientPath, 'utf-8');
      // 將設定動態注入用戶端代碼中
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

  // 接收型別回傳
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

  // 提供主動關閉伺服器
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

function stopServer() {
  if (serverInstance) {
    serverInstance.close();
    saveTypes();
    console.log(chalk.blue('🔌 型別收集背景伺服器已關閉。'));
  }
}

module.exports = {
  startServer,
  stopServer
};
