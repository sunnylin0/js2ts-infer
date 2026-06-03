const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { mergeDatabases } = require('../type-merger');

function merge(files, options) {
  if (!files || files.length === 0) {
    console.error(chalk.red('❌ 請指定至少一個要合併的 JSON 檔案！'));
    process.exit(1);
  }

  const outPath = path.resolve(process.cwd(), options.out);
  console.log(chalk.blue(`🔄 開始合併 ${files.length} 份型別資料庫...`));

  let finalDB = {};

  for (const file of files) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      console.warn(chalk.yellow(`⚠ 檔案不存在，跳過: ${file}`));
      continue;
    }

    let db;
    try {
      db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.error(chalk.red(`❌ 無法解析檔案: ${file}, 錯誤: ${e.message}`));
      process.exit(1);
    }

    finalDB = mergeDatabases(finalDB, db);
    console.log(chalk.green(`  - 已合併: ${file}`));
  }

  try {
    fs.writeFileSync(outPath, JSON.stringify(finalDB, null, 2), 'utf-8');
    console.log(chalk.green(`✔ 成功輸出合併後的資料庫: ${outPath}`));
    console.log(chalk.green(`  - 總側錄節點數: ${Object.keys(finalDB).length}`));
  } catch (error) {
    console.error(chalk.red(`❌ 寫入合併檔案失敗: ${error.message}`));
    process.exit(1);
  }
}

module.exports = merge;
