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

function saveTypes() {
  const targetPath = path.resolve(process.cwd(), 'types-observed.json');
  try {
    fs.writeFileSync(targetPath, JSON.stringify(typeDB, null, 2), 'utf-8');
  } catch (e: any) {
    console.error(chalk.red(`❌ 寫入 types-observed.json 失敗: ${e.message}`));
  }
}

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

export function stopServer() {
  if (serverInstance) {
    serverInstance.close();
    saveTypes();
    console.log(chalk.blue('🔌 型別收集背景伺服器已關閉。'));
  }
}
