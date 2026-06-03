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
