import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { mergeDatabases } from '../type-merger';

interface MergeOptions {
  out: string;
}

/**
 * 合併多個暫存的 JSON 型別側錄資料庫檔。
 * 
 * @description
 * 讀取並解析所有指定的 JSON 側錄檔案，對內部同名欄位、參數、方法與類別
 * 進行型別寬化與聯集合併（Union Types），最終將結果輸出至指定的單一 JSON 檔案中。
 * 
 * @example
 * merge(['types1.json', 'types2.json'], { out: 'types-observed.json' });
 * 
 * @param {string[]} files - 欲合併的 JSON 檔案路徑清單。
 * @param {MergeOptions} options - 合併設定選項。
 * @param {string} options.out - 輸出的合併檔案路徑。
 * @returns {void} 本方法不回傳任何值。
 * @throws {Error} 當檔案無法解析或寫入目標路徑失敗時拋出錯誤並中斷程式。
 */
export default function merge(files: string[], options: MergeOptions): void {
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

    let db: any;
    try {
      db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e: any) {
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
  } catch (error: any) {
    console.error(chalk.red(`❌ 寫入合併檔案失敗: ${error.message}`));
    process.exit(1);
  }
}
