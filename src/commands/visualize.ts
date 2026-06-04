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

function openBrowser(url: string) {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const cmd = isWin ? `start ${url}` : isMac ? `open ${url}` : `xdg-open ${url}`;
  exec(cmd, () => {});
}

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
