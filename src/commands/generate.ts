import { runGeneration } from '../code-generator';

interface GenerateOptions {
  config: string;
  dryRun?: boolean;
  force?: boolean;
  inDir?: string;
  outDir?: string;
}

/**
 * 執行型別生成與重構指令的主進入點。
 * 
 * @description
 * 結合靜態依賴地圖與動態偵測到的型別，對專案源碼進行 AST 解析，
 * 自動注入合適的 TypeScript 型別並將副檔名由 `.js` 轉為 `.ts`。
 * 
 * @example
 * await generate({
 *   config: 'js2ts.config.json',
 *   inDir: './src',
 *   outDir: './srcTS',
 *   force: true
 * });
 * 
 * @param {GenerateOptions} options - 產生器配置選項。
 * @param {string} options.config - 設定檔路徑。
 * @param {boolean} [options.dryRun] - 是否僅執行 Dry Run 輸出 Diff，不實際修改檔案。
 * @param {boolean} [options.force] - 是否忽略 Git 未提交狀態檢查強制執行。
 * @param {string} [options.inDir] - 來源專案路徑。
 * @param {string} [options.outDir] - 重構輸出的目標路徑。
 * @returns {Promise<void>} 回傳一個 Promise，解析後代表型別注入重構完成。
 */
export default async function generate(options: GenerateOptions): Promise<void> {
  await runGeneration(options);
}
