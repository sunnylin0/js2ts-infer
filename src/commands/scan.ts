import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { analyzeProject } from '../static-analyzer';

interface ScanOptions {
  config: string;
}

/**
 * 執行專案靜態依賴與邊界 API 掃描分析。
 * 
 * @description
 * 載入指定設定檔，分析 include 範圍內的所有 JavaScript 檔案之 Import、Require 
 * 與 CallExpression，識別專案中 Class 之繼承與靜態呼叫關係，並導出邊界 API/Exports，
 * 最終將掃描獲得的地圖輸出至專案根目錄的 `boundary-map.json` 中。
 * 
 * @example
 * scan({ config: 'js2ts.config.json' });
 * 
 * @param {ScanOptions} options - 掃描設定選項。
 * @param {string} options.config - 設定檔路徑。
 * @returns {void} 本方法不回傳任何值。
 * @throws {Error} 當無法讀取設定檔或靜態分析過程中遭遇語法錯誤時會拋出異常並退出。
 */
export default function scan(options: ScanOptions): void {
  const configPath = path.resolve(process.cwd(), options.config);
  
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`❌ 找不到設定檔：${configPath}。請先執行 npx js2ts-infer init`));
    process.exit(1);
  }

  let config: any;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error: any) {
    console.error(chalk.red(`❌ 無法讀取或解析設定檔：${error.message}`));
    process.exit(1);
  }

  console.log(chalk.blue('🔍 開始靜態分析專案與導出邊界...'));

  try {
    const result = analyzeProject(config);
    const boundaryMapPath = path.resolve(process.cwd(), 'boundary-map.json');
    
    fs.writeFileSync(boundaryMapPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(chalk.green(`✔ 靜態分析完成！`));
    console.log(chalk.green(`  - 找到 Class 定義數量: ${Object.keys(result.classes).length}`));
    console.log(chalk.green(`  - 識別出邊界 API/Exports 數量: ${result.boundaries.length}`));
    console.log(chalk.green(`  - 輸出邊界地圖: ${boundaryMapPath}`));
  } catch (error: any) {
    console.error(chalk.red(`❌ 靜態分析過程中發生錯誤：${error.message}`));
    console.error(error.stack);
    process.exit(1);
  }
}
