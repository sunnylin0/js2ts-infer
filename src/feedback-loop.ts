import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { globSync } from 'glob';
import chalk from 'chalk';

interface TypeCheckError {
  filePath: string;
  line: number; // 0-indexed
  character: number;
  code: number;
  messageText: string;
  errorSnippet: string;
  sourceText: string;
}

// 關注的型別相關錯誤代碼
const TARGET_ERROR_CODES = new Set([
  2322, // Type 'X' is not assignable to type 'Y'
  2339, // Property 'X' does not exist on type 'Y'
  2345, // Argument of type 'X' is not assignable to parameter of type 'Y'
  2531, // Object is possibly 'null'
  2532, // Object is possibly 'undefined'
  2540, // Cannot assign to 'X' because it is a read-only property (有時需改為 non-readonly)
  7006, // Parameter 'X' implicitly has an 'any' type (隱式 any 錯誤)
]);

/**
 * 載入專案的 tsconfig.json 配置，若無則回退至預設值
 */
/**
 * 載入指定輸出目錄的 tsconfig.json，以獲取與專案一致的編譯選項。
 * 
 * @description
 * 讀取並解析 `tsconfig.json`。若檔案不存在或解析出錯，
 * 則回退至一組安全的預設值（ES2022 / NodeNext / 關閉 strict / 僅檢查不發射代碼 / 跳過庫檢查）。
 * 
 * @param {string} outDir - 專案的輸出目錄路徑。
 * @returns {ts.CompilerOptions} 適合目前專案環境的 TypeScript 編譯選項。
 */
function getCompilerOptions(outDir: string): ts.CompilerOptions {
  const tsconfigPath = path.join(outDir, 'tsconfig.json');
  if (fs.existsSync(tsconfigPath)) {
    try {
      const parsed = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (parsed.config) {
        const configParsed = ts.parseJsonConfigFileContent(
          parsed.config,
          ts.sys,
          outDir
        );
        return configParsed.options;
      }
    } catch (e: any) {
      console.warn(chalk.yellow(`⚠ 讀取 tsconfig.json 失敗: ${e.message}。使用預設編譯選項。`));
    }
  }

  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: false,
    noEmit: true,
    skipLibCheck: true
  };
}

/**
 * 對輸出目錄下的所有檔案執行 TSC 語義診斷，提取目標錯誤
 */
/**
 * 對指定的 TypeScript 檔案列表執行編譯器語意診斷，過濾出核心型別相關的錯誤。
 * 
 * @description
 * 建立一個 TypeScript `Program`，調用 `getSemanticDiagnostics`。
 * 過濾並只保留感興趣的核心型別衝突錯誤（如型別不相容、屬性不存在、可能為 undefined 等）。
 * 針對每個診斷錯誤，計算出錯誤發生的檔案行號、字元位置，並擷取出錯誤的程式碼片段。
 * 
 * @param {string[]} tsFiles - 待分析的 TypeScript 原始碼檔案路徑列表。
 * @param {ts.CompilerOptions} compilerOptions - 編譯器配置選項。
 * @returns {TypeCheckError[]} 所有過濾後的型別相關錯誤物件清單。
 */
function runTscDiagnostics(tsFiles: string[], compilerOptions: ts.CompilerOptions): TypeCheckError[] {
  const program = ts.createProgram(tsFiles, compilerOptions);
  const diagnostics = program.getSemanticDiagnostics();

  const errors: TypeCheckError[] = [];
  for (const diag of diagnostics) {
    if (diag.file && diag.start !== undefined && diag.length !== undefined) {
      const file = diag.file;
      const code = diag.code;

      if (TARGET_ERROR_CODES.has(code)) {
        const { line, character } = file.getLineAndCharacterOfPosition(diag.start);
        const sourceText = file.getText();
        const errorSnippet = sourceText.substring(diag.start, diag.start + diag.length);
        const messageText = ts.flattenDiagnosticMessageText(diag.messageText, "\n");

        errors.push({
          filePath: file.fileName,
          line,
          character,
          code,
          messageText,
          errorSnippet,
          sourceText
        });
      }
    }
  }
  return errors;
}

/**
 * 呼叫 Gemini API 獲取修復 Patch
 */
/**
 * 呼叫 Gemini 語言模型 API，根據編譯錯誤的上下文推導並獲取修正補丁。
 * 
 * @description
 * 向 API 發送包含系統指令與使用者錯誤上下文的 JSON 請求，要求回傳 `targetCode` 與 `patchedCode`。
 * 內建 429 (Too Many Requests) 容錯重試機制：當 API 回傳 429 錯誤時，自動讀取 RetryInfo 中
 * 的 `retryDelay` 延遲秒數，執行退避等待並自動重新發送請求，最多重試 3 次。
 * 
 * @param {string} apiKey - 認證用 Gemini API Key。
 * @param {string} model - 使用的模型代稱（如 gemini-2.5-flash）。
 * @param {string} systemPrompt - 系統提示詞，定義 AI 行為規範與回傳 JSON 格式要求。
 * @param {any} userPromptObj - 包含具體錯誤訊息、出錯代碼片段與上下文的 Prompt 物件。
 * @param {number} [attempt=1] - 目前是第幾次嘗試呼叫。
 * @returns {Promise<{ targetCode: string; patchedCode: string } | null>} 解析成功後回傳補丁結果，若失敗則回傳 `null`。
 */
async function callGeminiForFix(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPromptObj: any,
  attempt = 1
): Promise<{ targetCode: string; patchedCode: string } | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: JSON.stringify(userPromptObj, null, 2)
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemPrompt
        }
      ]
    },
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 429) {
      if (attempt <= 3) {
        let waitSeconds = 35;
        try {
          const errData = await response.clone().json();
          const delayStr = errData.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
          if (delayStr && typeof delayStr === 'string') {
            const parsed = parseInt(delayStr);
            if (!isNaN(parsed)) {
              waitSeconds = parsed + 2;
            }
          }
        } catch (e) {}

        console.log(chalk.yellow(`⚠ 觸發 API 頻率限制 (HTTP 429)。將於 ${waitSeconds} 秒後進行第 ${attempt} 次重試...`));
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        return callGeminiForFix(apiKey, model, systemPrompt, userPromptObj, attempt + 1);
      } else {
        console.error(chalk.red(`❌ 已達到 API 重試上限，放棄此錯誤之修復。`));
        return null;
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(chalk.red(`❌ Gemini API 請求失敗 (HTTP ${response.status}): ${errText}`));
      return null;
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) {
      console.error(chalk.red(`❌ Gemini API 回傳內容中無 text 欄位`));
      return null;
    }

    const fixResult = JSON.parse(textResult);
    if (fixResult.targetCode !== undefined && fixResult.patchedCode !== undefined) {
      return fixResult;
    }
    console.error(chalk.red(`❌ Gemini 回傳 JSON 欄位不符規格: ${textResult}`));
    return null;
  } catch (err: any) {
    console.error(chalk.red(`❌ 呼叫 Gemini API 時發生網路或解析錯誤: ${err.message}`));
    return null;
  }
}

/**
 * TSC 反饋與 AI 修正的主控制迴圈
 */
/**
 * 執行 TSC 反饋與 AI 自我修正的主控制迴圈。
 * 
 * @description
 * 1. 檢測是否存在 `GEMINI_API_KEY`，若無則跳過。
 * 2. 在最大迭代次數限制內，重複執行：
 *    a. 掃描輸出目錄下的所有 `.ts` 檔案。
 *    b. 呼叫 `runTscDiagnostics` 進行型別診斷。若無錯誤，則提早收斂結束。
 *    c. 針對每個有型別錯誤的檔案，擷取該行上下 15 行作為 Context。
 *    d. 發送請求至 Gemini 取得修正後的 `patchedCode`。
 *    e. 當同一個位置連續失敗次數過多時，啟用強制 any 降級策略，以求順利通過編譯。
 *    f. 將修正套用回原始檔案，並進入下一次迭代。
 * 
 * @example
 * await runFeedbackLoop('./srcTS', config);
 * 
 * @param {string} outDir - 待進行型別檢查與修正的專案目錄。
 * @param {any} config - 使用者配置（包含 API key、模型、最大迭代次數等參數）。
 * @returns {Promise<void>} 回傳一個 Promise，解析後代表自我修正迴圈執行結束。
 */
export async function runFeedbackLoop(outDir: string, config: any) {
  const apiKey = process.env.GEMINI_API_KEY || config.aiApiKey;
  if (!apiKey) {
    console.log(chalk.yellow('\n⚠ 未偵測到 GEMINI_API_KEY 或 config 中的 aiApiKey。跳過 TSC 反饋與 AI 自我修正階段。'));
    return;
  }

  const model = config.aiModel || 'gemini-2.5-flash';
  const maxIterations = config.maxFeedbackIterations || 5;

  console.log(chalk.blue(`\n🔄 啟動 TSC 編譯錯誤反饋循環與 AI 自我修正 (模型: ${model}, 最大迭代: ${maxIterations} 次)...`));

  const compilerOptions = getCompilerOptions(outDir);

  // 記錄每個出錯點 (file:line:code) 的嘗試次數，用於 fallback 降級 any
  const attemptMap = new Map<string, number>();

  // 用來比對前後兩次迭代的錯誤狀況，以防陷入死循環
  let lastErrorsKey = '';

  for (let iter = 1; iter <= maxIterations; iter++) {
    const tsFiles = globSync('**/*.ts', {
      cwd: outDir,
      ignore: ['**/*.d.ts', 'node_modules/**'],
      nodir: true,
      absolute: true
    });

    if (tsFiles.length === 0) {
      console.log(chalk.yellow('⚠ 輸出目錄下找不到任何待檢查的 *.ts 檔案。'));
      break;
    }

    const errors = runTscDiagnostics(tsFiles, compilerOptions);
    if (errors.length === 0) {
      console.log(chalk.green(`✔ [第 ${iter} 次迭代] TSC 編譯無核心型別錯誤！自我修正完美收斂。`));
      break;
    }

    console.log(chalk.yellow(`\n[第 ${iter} 次迭代] 偵測到 ${errors.length} 個與型別相關的編譯錯誤...`));

    // 比對錯誤是否與上次完全相同
    const currentErrorsKey = errors.map(e => `${path.basename(e.filePath)}:${e.line}:${e.code}`).join('|');
    if (currentErrorsKey === lastErrorsKey) {
      console.warn(chalk.red(`❌ 迭代後錯誤數及出錯位置完全相同，無法進一步收斂。中斷自我修正。`));
      break;
    }
    lastErrorsKey = currentErrorsKey;

    // 將錯誤按照檔案分組
    const errorsByFile: Record<string, TypeCheckError[]> = {};
    for (const err of errors) {
      if (!errorsByFile[err.filePath]) {
        errorsByFile[err.filePath] = [];
      }
      errorsByFile[err.filePath].push(err);
    }

    let fixAppliedCount = 0;

    // 每次迭代對每個出錯的檔案修復第一個錯誤，防止字元座標偏移干擾
    for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
      const err = fileErrors[0]; // 只拿第一個
      const relPath = path.relative(outDir, filePath).replace(/\\/g, '/');
      const errKey = `${relPath}:${err.line}:${err.code}`;

      const attempts = (attemptMap.get(errKey) || 0) + 1;
      attemptMap.set(errKey, attempts);

      console.log(chalk.blue(`🛠 正在嘗試修復 [${relPath} 行 ${err.line + 1}] 錯誤 ${err.code} (嘗試第 ${attempts} 次/上限 3 次)...`));

      // 擷取上下 15 行的 context
      const lines = err.sourceText.split('\n');
      const startIdx = Math.max(0, err.line - 15);
      const endIdx = Math.min(lines.length - 1, err.line + 15);
      const contextCode = lines
        .slice(startIdx, endIdx + 1)
        .map((l, idx) => `${startIdx + idx + 1}: ${l}`)
        .join('\n');

      // 準備 System Prompt
      const systemPrompt = `你是一個專門修復 TypeScript 編譯錯誤的 AST 重構代理。
你的任務是讀取一段含有 TSC 編譯錯誤的程式碼與錯誤訊息，並給出修復後的型別宣告。

規則：
1. 僅修改型別宣告，不要更改原本 JS 的執行邏輯。
2. 優先考慮將型別改為 union 型別 (例如 X | null) 或加上可選屬性 (X?)，而不是直接改為 any。
3. 如果該型別是來自外部介面，請提供該變數應有的正確型別或加上類型斷言 (Type Assertion, as X)。
4. 請回傳一個 JSON 格式，必須包含要替換的目標程式碼 (targetCode) 與替換後的程式碼 (patchedCode)。
5. 回傳的 targetCode 必須精確出現在給定的程式碼中（包含縮排字元與空格，請勿任意刪減）。
6. 回傳的 patchedCode 必須是 targetCode 的完整替换。`;

      const userPromptObj: any = {
        errorMessage: err.messageText,
        errorSnippet: err.errorSnippet,
        errorLocation: `${relPath} 第 ${err.line + 1} 行, 字元 ${err.character + 1}`,
        contextCode: contextCode
      };

      // 判定是否需要強制降級 any (Fallback 策略)
      if (attempts >= 3) {
        userPromptObj.fallbackInstruction = "【強制警告】由於之前幾次修復嘗試都失敗了，請直接將此處發生型別衝突的變數、參數或屬性型別聲明修改為 any 或是含有 any 的型別 (例如 `any` 或 `AbcJS4.Lines | any` 等)，以強制消除此處的 TypeScript 編譯錯誤。";
      }

      // 呼叫 AI
      const patch = await callGeminiForFix(apiKey, model, systemPrompt, userPromptObj);
      if (patch) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        if (fileContent.includes(patch.targetCode)) {
          const updatedContent = fileContent.replace(patch.targetCode, patch.patchedCode);
          fs.writeFileSync(filePath, updatedContent, 'utf-8');
          console.log(chalk.green(`✔ 成功套用補丁於: ${relPath}`));
          fixAppliedCount++;
        } else {
          console.warn(chalk.yellow(`⚠ 無法套用補丁: targetCode 與檔案內容不符。\n   Expected: "${patch.targetCode}"`));
        }
      }
    }

    if (fixAppliedCount === 0) {
      console.log(chalk.yellow(`⚠ 此次迭代沒有成功套用任何補丁，停止自我修正。`));
      break;
    }
  }

  console.log(chalk.green('✔ TSC 反饋與 AI 自我修正階段結束。'));
}
