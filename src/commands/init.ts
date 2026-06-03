import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const DEFAULT_CONFIG = {
  include: ["src/**/*.js", "modules/**/*.js", "*.js"],
  exclude: ["node_modules/**", "**/dist/**", "**/*.test.js", "**/test/**"],
  trackerPort: 9002,
  maxDepth: 5,
  confidenceThreshold: 5,
  interfaceThreshold: 3
};

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
