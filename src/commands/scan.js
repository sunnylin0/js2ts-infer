const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { analyzeProject } = require('../static-analyzer');

function scan(options) {
  const configPath = path.resolve(process.cwd(), options.config);
  
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`❌ 找不到設定檔：${configPath}。請先執行 npx js2ts-infer init`));
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
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
  } catch (error) {
    console.error(chalk.red(`❌ 靜態分析過程中發生錯誤：${error.message}`));
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = scan;
