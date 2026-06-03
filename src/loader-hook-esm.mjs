import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import babel from '@babel/core';
import { globSync } from 'glob';
import customBabelPlugin from './babel-plugin-js2ts.js';

// 初始化全域 tracker-client
import './tracker-client.js';

let config = {
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

const instrumentableFiles = new Set();
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

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);

  if (url.startsWith('file://')) {
    const filename = path.resolve(fileURLToPath(url));
    console.log(`[ESM DEBUG] load: ${filename}, in set: ${instrumentableFiles.has(filename.toLowerCase())}`);

    if (instrumentableFiles.has(filename.toLowerCase()) && result.source) {
      try {
        const code = typeof result.source === 'string' ? result.source : result.source.toString();
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
      } catch (err) {
        console.error(`❌ [js2ts-infer-esm] 動態記憶體插樁失敗: ${path.relative(process.cwd(), filename)}, 錯誤: ${err.message}`);
      }
    }
  }

  return result;
}

console.log(`🔌 [js2ts-infer] ESM 記憶體動態插樁載入器已啟用。監聽 ${instrumentableFiles.size} 個檔案。`);
