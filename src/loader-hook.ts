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
