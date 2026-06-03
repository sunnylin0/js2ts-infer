const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const { startServer, stopServer } = require('../tracker-server');

async function run(command, options) {
  const configPath = path.resolve(process.cwd(), options.config);
  
  let config = {
    trackerPort: 9002,
    maxDepth: 5
  };

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.warn(chalk.yellow(`⚠ 讀取設定檔失敗: ${e.message}。將使用預設設定。`));
    }
  }

  const port = config.trackerPort || 9002;

  // 1. 啟動型別收集伺服器
  let server;
  try {
    server = await startServer(port, config);
  } catch (err) {
    console.error(chalk.red(`❌ 無法啟動型別收集伺服器: ${err.message}`));
    process.exit(1);
  }

  // 2. 設置環境變數以掛載 Hook
  const loaderHookCjs = path.resolve(__dirname, '../loader-hook.js').replace(/\\/g, '/');
  const loaderHookEsm = path.resolve(__dirname, '../loader-hook-esm.mjs').replace(/\\/g, '/');
  
  // 同時掛載 CJS 與 ESM Hook
  let nodeOptions = ` --require "${loaderHookCjs}" --experimental-loader "file:///${loaderHookEsm}"`;
  
  const env = {
    ...process.env,
    NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + nodeOptions
  };

  console.log(chalk.blue(`🏃 執行指令: ${command}`));
  console.log(chalk.blue(`🔌 已注入記憶體插樁 Hook。`));

  // 3. 執行指令
  // 在 Windows 系統上使用 cmd /c 執行 shell 指令，在 Unix 上使用 sh -c
  const isWin = process.platform === 'win32';
  const shell = isWin ? 'cmd.exe' : '/bin/sh';
  const args = isWin ? ['/d', '/s', '/c', command] : ['-c', command];

  const child = spawn(shell, args, {
    stdio: 'inherit',
    env: env,
    windowsVerbatimArguments: true
  });

  child.on('close', (code) => {
    console.log(chalk.blue(`🏁 指令執行結束，退出代碼: ${code}`));
    
    // 4. 關閉伺服器並寫檔
    stopServer();
    
    const typesObservedPath = path.resolve(process.cwd(), 'types-observed.json');
    if (fs.existsSync(typesObservedPath)) {
      console.log(chalk.green(`✔ 型別側錄成功！已存檔至: ${typesObservedPath}`));
    } else {
      console.log(chalk.yellow(`⚠ 未偵測到任何型別。請確認代碼是否有被執行且符合包含範圍。`));
    }
    
    process.exit(code);
  });

  child.on('error', (err) => {
    console.error(chalk.red(`❌ 執行指令時出錯: ${err.message}`));
    stopServer();
    process.exit(1);
  });
}

module.exports = run;
