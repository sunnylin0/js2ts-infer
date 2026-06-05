import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import chalk from 'chalk';
import { exec } from 'child_process';

interface VisualizeOptions {
  config: string;
  port?: string;
}

/**
 * 根據目前作業系統平台，自動在預設瀏覽器中開啟指定網址。
 * 
 * @description
 * 辨識 `process.platform`，在 Windows 調用 `start`，在 macOS 調用 `open`，
 * 在 Linux 調用 `xdg-open`，以非同步背景程序方式開啟檢視網頁。
 * 
 * @param {string} url - 欲在瀏覽器中開啟的完整 URL 網址。
 * @returns {void} 本方法不回傳任何值。
 */
function openBrowser(url: string) {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const cmd = isWin ? `start ${url}` : isMac ? `open ${url}` : `xdg-open ${url}`;
  exec(cmd, () => {});
}

/**
 * 啟動 Call Graph 呼叫關係鏈與型別依賴關係的互動式 Web 視覺化檢視工具。
 * 
 * @description
 * 1. 啟動一個 Express 背景伺服器（預設埠號 9003）。
 * 2. 提供 `/api/data` 介面，讀取 `boundary-map.json`、`types-observed.json` 及視覺化佈局設定檔。
 * 3. 提供 `/api/layout` POST 介面，支援使用者在網頁上拖曳固定節點位置後回傳存檔至 `visualizer-layout.json`。
 * 4. 自動開啟預設瀏覽器展示以 D3.js 繪製的暗黑霓虹風格關係圖。
 * 
 * @example
 * visualize({ config: 'js2ts.config.json', port: '9003' });
 * 
 * @param {VisualizeOptions} options - 視覺化檢視設定選項。
 * @param {string} options.config - 設定檔路徑。
 * @param {string} [options.port] - 指定的 Express 伺服器埠號。
 * @returns {void} 本方法不回傳任何值。
 */
export default function visualize(options: VisualizeOptions): void {
  const configPath = path.resolve(process.cwd(), options.config);
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {}
  }

  const port = parseInt(options.port || config.visualizerPort || '9003', 10);
  const app = express();

  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));

  // Serve visualizer.html
  app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, '../templates/visualizer.html');
    if (fs.existsSync(htmlPath)) {
      res.setHeader('Content-Type', 'text/html');
      res.send(fs.readFileSync(htmlPath, 'utf-8'));
    } else {
      res.status(404).send('Visualizer template not found. Please run build.');
    }
  });

  // API to fetch data
  app.get('/api/data', (req, res) => {
    let boundaryMap = { classes: {}, boundaries: [], staticCallGraph: { files: [], functions: [] } };
    let typesObserved = {};
    let layout = {};

    const boundaryMapPath = path.resolve(process.cwd(), 'boundary-map.json');
    if (fs.existsSync(boundaryMapPath)) {
      try {
        boundaryMap = JSON.parse(fs.readFileSync(boundaryMapPath, 'utf-8'));
      } catch (e) {}
    }

    const typesObservedPath = path.resolve(process.cwd(), 'types-observed.json');
    if (fs.existsSync(typesObservedPath)) {
      try {
        typesObserved = JSON.parse(fs.readFileSync(typesObservedPath, 'utf-8'));
      } catch (e) {}
    }

    const layoutPath = path.resolve(process.cwd(), 'visualizer-layout.json');
    if (fs.existsSync(layoutPath)) {
      try {
        layout = JSON.parse(fs.readFileSync(layoutPath, 'utf-8'));
      } catch (e) {}
    }

    res.json({
      boundaryMap,
      typesObserved,
      layout
    });
  });

  // API to save layout
  app.post('/api/layout', (req, res) => {
    const layout = req.body || {};
    const layoutPath = path.resolve(process.cwd(), 'visualizer-layout.json');
    try {
      fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2), 'utf-8');
      console.log(chalk.green(`✔ 視覺化佈局已成功存檔: ${layoutPath}`));
      res.json({ success: true });
    } catch (err: any) {
      console.error(chalk.red(`❌ 儲存視覺化佈局失敗: ${err.message}`));
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(chalk.blue(`🚀 Call Graph 互動式視覺化檢視工具已啟動：${url}`));
    console.log(chalk.blue('👉 正在自動開啟瀏覽器...'));
    openBrowser(url);
  });
}
