const Module = require('module');
const path = require('path');
const fs = require('fs');
const babel = require('@babel/core');
const { globSync } = require('glob');
const customBabelPlugin = require('./babel-plugin-js2ts');

// 載入全域 tracker 客戶端
require('./tracker-client');

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

// 預先掃描所有匹配的檔案絕對路徑，建立快取 Set 以加速 require 攔截
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
  console.error('[js2ts-infer] 建立插樁檔案清單時出錯:', e.message);
}

const originalCompile = Module.prototype._compile;

Module.prototype._compile = function (content, filename) {
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
    } catch (err) {
      console.error(`❌ [js2ts-infer] 動態記憶體插樁失敗: ${path.relative(process.cwd(), filename)}, 錯誤: ${err.message}`);
    }
  }

  return originalCompile.apply(this, arguments);
};

console.log(`🔌 [js2ts-infer] CommonJS 記憶體動態插樁載入器已啟動。監聽 ${instrumentableFiles.size} 個檔案。`);
