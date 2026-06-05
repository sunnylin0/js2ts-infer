import Module from 'module';
import * as path from 'path';
import * as fs from 'fs';
import * as babel from '@babel/core';
import { globSync } from 'glob';
// @ts-ignore
import customBabelPlugin from './babel-plugin-js2ts';

// 引入 tracker-client
import './tracker-client';

let config = {
  include: ["src/**/*.js", "modules/**/*.js", "*.js"],
  exclude: ["node_modules/**", "**/dist/**", "**/*.test.js", "**/test/**"]
};

try {
  const configPath = path.resolve(process.cwd(), 'js2ts.config.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {}

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
} catch (e: any) {
  console.error('[js2ts-infer] 建立插樁檔案清單時出錯:', e.message);
}

// @ts-ignore
const originalCompile = Module.prototype._compile;

/**
 * 攔截並複寫 Node.js CommonJS Module 的 `_compile` 方法。
 * 
 * @description
 * 在 Node.js 載入並編譯每一個 CommonJS 模組時，比對檔案是否在 include 且非 exclude 清單中。
 * 若符合，則調用 Babel 將其源碼進行動態插樁注入側錄 Proxy，再將插樁後的程式碼遞交給原編譯器執行。
 * 
 * @param {string} content - 待編譯的 JS 原始碼內容.
 * @param {string} filename - 該模組的實體檔案路徑.
 * @returns {any} 原編譯器的編譯執行結果.
 */
// @ts-ignore
Module.prototype._compile = function (content: string, filename: string) {
  const absPath = path.resolve(filename);

  if (instrumentableFiles.has(absPath.toLowerCase())) {
    try {
      const result = babel.transformSync(content, {
        filename: filename,
        plugins: [customBabelPlugin],
        sourceMaps: 'inline',
        babelrc: false,
        configFile: false
      });
      
      if (result && result.code) {
        return originalCompile.call(this, result.code, filename);
      }
    } catch (err: any) {
      console.error(`❌ [js2ts-infer] 動態記憶體插樁失敗: ${path.relative(process.cwd(), filename)}, 錯誤: ${err.message}`);
    }
  }

  return originalCompile.apply(this, arguments as any);
};

console.log(`🔌 [js2ts-infer] CommonJS 記憶體動態插樁載入器已啟動。監聽 ${instrumentableFiles.size} 個檔案。`);
