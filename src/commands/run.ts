import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { startServer, stopServer } from '../tracker-server';

interface RunOptions {
  config: string;
}

/**
 * 檢查前端（Vite 或 Webpack）配置是否正確啟用了型別側錄插件。
 * 
 * @description
 * 讀取專案根目錄的 `package.json` 及設定檔，當偵測到專案包含 Vite 或是 Webpack 依賴時，
 * 檢查對應的設定檔（例如 `vite.config.*`）是否啟用了 `vitePlugin` 或 `webpackLoader` 插樁插件。
 * 若無，將在控制台輸出錯誤警告，以便提示開發者配置，防止無法正確收集瀏覽器端型別。
 * 
 * @returns {boolean} 若配置正確或無須配置則回傳 `true`，否則回傳 `false`。
 */
function checkFrontendConfig(): boolean {
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return true;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const hasVite = 'vite' in deps;
    const hasWebpack = 'webpack' in deps;
    let isValid = true;

    if (hasVite) {
      const viteConfigFiles = [
        'vite.config.js',
        'vite.config.ts',
        'vite.config.cjs',
        'vite.config.mjs',
        'vite.config.mts'
      ];
      const found = viteConfigFiles.find(f => fs.existsSync(path.join(cwd, f)));
      if (!found) {
        console.error(chalk.red(
          `\n❌ [錯誤] 偵測到此專案為 Vite 專案，但未在根目錄找到 vite.config.* 設定檔。\n` +
          `👉 請建立 vite.config.cjs 並配置 vitePlugin 以啟用前端型別插樁，否則將無法收集瀏覽器端的型別。\n`
        ));
        isValid = false;
      } else {
        const content = fs.readFileSync(path.join(cwd, found), 'utf-8');
        if (!content.includes('vitePlugin')) {
          console.error(chalk.red(
            `\n❌ [錯誤] 偵測到此專案已配置 ${found}，但內容似乎沒有啟用 vitePlugin 插件。\n` +
            `👉 請確保已在 plugins 陣列中加入 vitePlugin()。\n`
          ));
          isValid = false;
        }
      }
    }

    if (hasWebpack) {
      const webpackConfigFiles = [
        'webpack.config.js',
        'webpack.config.ts',
        'webpack.config.cjs',
        'webpack.config.mjs'
      ];
      const found = webpackConfigFiles.find(f => fs.existsSync(path.join(cwd, f)));
      if (found) {
        const content = fs.readFileSync(path.join(cwd, found), 'utf-8');
        if (!content.includes('webpackLoader') && !content.includes('js2ts-loader')) {
          console.error(chalk.red(
            `\n❌ [錯誤] 偵測到此專案已配置 ${found}，但內容似乎沒有啟用 webpackLoader。\n` +
            `👉 請確保在 module.rules 中設定了對應的 loader 以便收集瀏覽器端型別。\n`
          ));
          isValid = false;
        }
      }
    }
    return isValid;
  } catch (e) {
    return true;
  }
}

/**
 * 啟動型別收集伺服器，並在此環境下掛載動態代理 Hook 執行測試或應用指令。
 * 
 * @description
 * 1. 讀取 `js2ts.config.json` 取得連接埠號，並啟動用於側錄型別的 `tracker-server`。
 * 2. 根據目前 Node.js 版本，動態設置 `NODE_OPTIONS` 環境變數以載入 CJS/ESM Hook 記憶體插樁模組。
 * 3. 使用 `spawn` 執行開發者傳入的 Shell 指令（如測試腳本或開發伺服器啟動指令）。
 * 4. 指令執行結束時，自動關閉側錄伺服器並將收集到的型別資料寫入 `types-observed.json`。
 * 
 * @example
 * await run('pnpm run test', { config: 'js2ts.config.json' });
 * 
 * @param {string} command - 要執行的測試或應用 Shell 指令。
 * @param {RunOptions} options - 執行設定選項。
 * @param {string} options.config - 設定檔路徑。
 * @returns {Promise<void>} 回傳一個 Promise，解析後代表側錄與執行流程結束。
 * @throws {Error} 當啟動伺服器出錯或執行程序異常時會拋出錯誤並退出程式。
 */
export default async function run(command: string, options: RunOptions): Promise<void> {
  if (!checkFrontendConfig()) {
    process.exit(1);
  }

  
  const configPath = path.resolve(process.cwd(), options.config);
  
  let config: any = {
    trackerPort: 9002,
    maxDepth: 5
  };

  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e: any) {
      console.warn(chalk.yellow(`⚠ 讀取設定檔失敗: ${e.message}。將使用預設設定。`));
    }
  }

  const port = config.trackerPort || 9002;

  // 1. 啟動型別收集伺服器
  try {
    await startServer(port, config);
  } catch (err: any) {
    console.error(chalk.red(`❌ 無法啟動型別收集伺服器: ${err.message}`));
    process.exit(1);
  }

  // 2. 設置環境變數以掛載 Hook
  const loaderHookCjs = path.resolve(__dirname, '../loader-hook.js').replace(/\\/g, '/');
  const loaderHookEsm = path.resolve(__dirname, '../loader-hook-esm.mjs').replace(/\\/g, '/');
  const registerJs = path.resolve(__dirname, '../register.js').replace(/\\/g, '/');
  
  const [major, minor] = process.versions.node.split('.').map(Number);
  const supportImport = major > 20 || (major === 20 && minor >= 6);

  // 同時掛載 CJS 與 ESM Hook
  let nodeOptions = '';
  if (supportImport) {
    nodeOptions = ` --require "${loaderHookCjs}" --import "file:///${registerJs}"`;
  } else {
    nodeOptions = ` --require "${loaderHookCjs}" --experimental-loader "file:///${loaderHookEsm}"`;
  }
  
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
      try {
        const data = JSON.parse(fs.readFileSync(typesObservedPath, 'utf-8'));
        if (Object.keys(data).length === 0) {
          console.log(chalk.yellow(`⚠ 未偵測到任何型別。如果您是前端專案，請確保已開啟瀏覽器操作網頁，且已正確載入 vitePlugin / webpackLoader。`));
        } else {
          console.log(chalk.green(`✔ 型別側錄成功！已存檔至: ${typesObservedPath}`));
        }
      } catch (e) {
        console.log(chalk.green(`✔ 型別側錄成功！已存檔至: ${typesObservedPath}`));
      }
    } else {
      console.log(chalk.yellow(`⚠ 未偵測到任何型別。請確認代碼是否有被執行且符合包含範圍。`));
    }
    
    process.exit(code ?? 0);
  });

  child.on('error', (err: any) => {
    console.error(chalk.red(`❌ 執行指令時出錯: ${err.message}`));
    stopServer();
    process.exit(1);
  });
}
