import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import * as babel from '@babel/core';
import { globSync } from 'glob';
// @ts-ignore
import customBabelPlugin from './babel-plugin-js2ts.js';
import './tracker-client.js';

interface Config {
  include: string[];
  exclude: string[];
}

let config: Config = {
  include: ["src/**/*.js", "modules/**/*.js", "*.js"],
  exclude: ["node_modules/**", "**/dist/**", "**/*.test.js", "**/test/**"]
};

// 載入設定檔
try {
  const configPath = path.resolve(process.cwd(), 'js2ts.config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  // 忽略
}

const instrumentableFiles = new Set<string>();
try {
  const files = globSync(config.include, {
    ignore: config.exclude,
    nodir: true,
    absolute: true
  });
  files.forEach(f => {
    instrumentableFiles.add(path.resolve(f).toLowerCase());
  });
} catch (e) {
  // 忽略
}

/**
 * Node.js ESM 自訂加載鉤子 (Loader Hook)，用於在 ESM 模組加載時執行動態記憶體插樁。
 * 
 * @description
 * 攔截 Node.js 載入的模組 URL。若是本機 file 協議且位於 include 掃描範圍內的 JavaScript 檔案，
 * 則調用 Babel 對其源碼進行動態插樁，注入型別側錄 Proxy，最後將插樁後的程式碼交還給 Node.js 執行期。
 * 
 * @param {string} url - 模組的 URL 路徑。
 * @param {object} context - 載入上下文資訊，如模組的 format。
 * @param {Function} nextLoad - 下一個加載鏈處理函數。
 * @returns {Promise<{ format: string; source: string }>} 包含模組格式與插樁後源碼的物件。
 */
export async function load(
  url: string,
  context: { format?: string; [key: string]: any },
  nextLoad: (url: string, context: any) => Promise<{ format: string; source: string | ArrayBuffer | SharedArrayBuffer | Uint8Array }>
) {
  const result = await nextLoad(url, context);

  if (url.startsWith('file://')) {
    const filename = path.resolve(fileURLToPath(url));
    console.log(`[ESM DEBUG] load: ${filename}, in set: ${instrumentableFiles.has(filename.toLowerCase())}`);

    if (instrumentableFiles.has(filename.toLowerCase()) && result.source) {
      try {
        const code = typeof result.source === 'string' ? result.source : Buffer.from(result.source as any).toString('utf-8');
        console.log(`[ESM DEBUG] Instrumenting: ${filename}`);
        const transformResult = babel.transformSync(code, {
          filename: filename,
          plugins: [customBabelPlugin],
          sourceMaps: 'inline',
          babelrc: false,
          configFile: false
        });

        if (transformResult && transformResult.code) {
          return {
            format: result.format || 'module',
            source: transformResult.code
          };
        }
      } catch (err: any) {
        console.error(`❌ [js2ts-infer-esm] 動態記憶體插樁失敗: ${path.relative(process.cwd(), filename)}, 錯誤: ${err.message}`);
      }
    }
  }

  return result;
}

console.log(`🔌 [js2ts-infer] ESM 記憶體動態插樁載入器已啟用。監聽 ${instrumentableFiles.size} 個檔案。`);
