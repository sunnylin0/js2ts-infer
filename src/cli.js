#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();
const path = require('path');

// 載入指令實作
const initCmd = require('./commands/init');
const scanCmd = require('./commands/scan');
const runCmd = require('./commands/run');
const mergeCmd = require('./commands/merge');
const generateCmd = require('./commands/generate');
const reviewCmd = require('./commands/review');

program
  .name('js2ts-infer')
  .description('JS -> TS 執行時期型別輔助轉換工具')
  .version('1.0.0');

program
  .command('init')
  .description('於專案目錄產生 js2ts.config.json 設定檔')
  .action(() => {
    initCmd();
  });

program
  .command('scan')
  .description('掃描專案以建立 Class 定義地圖並識別邊界 API/Exports')
  .option('-c, --config <path>', '設定檔路徑', 'js2ts.config.json')
  .action((options) => {
    scanCmd(options);
  });

program
  .command('run <command>')
  .description('載入動態代理 Hook 執行測試或應用，並啟動 HTTP 伺服器側錄型別')
  .option('-c, --config <path>', '設定檔路徑', 'js2ts.config.json')
  .action((cmd, options) => {
    runCmd(cmd, options);
  });

program
  .command('merge <files...>')
  .description('合併多份側錄的 JSON 檔案，處理型別聯集')
  .option('-o, --out <path>', '輸出檔案路徑', 'types-observed.json')
  .action((files, options) => {
    mergeCmd(files, options);
  });

program
  .command('generate')
  .description('結合靜態與動態型別，執行型別雙向傳播並注入原始碼')
  .option('-c, --config <path>', '設定檔路徑', 'js2ts.config.json')
  .option('-d, --dry-run', '輸出變更的 Diff Log，不實際修改檔案', false)
  .option('-f, --force', '強制執行，忽略 Git 工作區未提交檢查', false)
  .action((options) => {
    generateCmd(options);
  });

program
  .command('review')
  .description('在終端機啟動互動式 Review 介面')
  .option('-c, --config <path>', '設定檔路徑', 'js2ts.config.json')
  .action((options) => {
    reviewCmd(options);
  });

program.parse(process.argv);
