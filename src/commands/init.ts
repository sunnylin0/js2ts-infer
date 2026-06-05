import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const DEFAULT_CONFIG = {
  include: ["src/**/*.js", "modules/**/*.js", "*.js"],
  exclude: ["node_modules/**", "**/dist/**", "**/*.test.js", "**/test/**"],
  excludeCallGraph: [],
  trackerPort: 9002,
  maxDepth: 5,
  confidenceThreshold: 5,
  interfaceThreshold: 3,
  aiApiKey: "",
  aiModel: "gemini-2.5-flash",
  maxFeedbackIterations: 5
};

/**
 * 初始化並在專案根目錄下生成預設的設定檔。
 * 
 * @description
 * 此方法會在目前的執行目錄 (cwd) 中偵測是否已有 `js2ts.config.json`。
 * 若不存在，將寫入預設的排除路徑、型別合併深度、測試側錄伺服器埠號等相關配置項。
 * 
 * @example
 * init();
 * 
 * @returns {void} 本方法不回傳任何值。
 */
export default function init(): void {
  const configPath = path.join(process.cwd(), 'js2ts.config.json');
  
  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow(`⚠ ${configPath} 已存在，拒絕覆寫。`));
    return;
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    console.log(chalk.green(`✔ 成功生成設定檔：${configPath}`));
  } catch (error: any) {
    console.error(chalk.red(`❌ 無法建立設定檔：${error.message}`));
  }
}
