const fs = require('fs');
const path = require('path');

const srcPath = path.resolve(__dirname, 'dist-esm/loader-hook-esm.js');
const destPath = path.resolve(__dirname, 'dist/loader-hook-esm.mjs');
const registerPath = path.resolve(__dirname, 'dist/register.js');
const esmDir = path.resolve(__dirname, 'dist-esm');

console.log('🔄 執行建置後置處理 (Build Post-Process)...');

if (fs.existsSync(srcPath)) {
  try {
    fs.copyFileSync(srcPath, destPath);
    console.log('✔ 成功生成: dist/loader-hook-esm.mjs');
  } catch (err) {
    console.error(`❌ 生成 mjs 失敗: ${err.message}`);
    process.exit(1);
  }
  
  try {
    fs.rmSync(esmDir, { recursive: true, force: true });
    console.log('✔ 成功清理臨時目錄: dist-esm/');
  } catch (err) {
    console.warn(`⚠ 清理 dist-esm/ 失敗: ${err.message}`);
  }
} else {
  console.warn('⚠ 找不到 dist-esm/loader-hook-esm.js。請確認編譯是否成功。');
}

// 產生用於 Node.js >= 20.6.0 的 register 入口
try {
  const registerContent = `
const { register } = require('node:module');
const { pathToFileURL } = require('node:url');

if (register) {
  try {
    const hookUrl = pathToFileURL(require.resolve('./loader-hook-esm.mjs')).href;
    register(hookUrl);
  } catch (e) {
    console.error('[js2ts-infer-register] 註冊 ESM 載入器失敗:', e.message);
  }
}
`;
  fs.writeFileSync(registerPath, registerContent.trim() + '\n', 'utf-8');
  console.log('✔ 成功生成: dist/register.js');
} catch (err) {
  console.error(`❌ 生成 dist/register.js 失敗: ${err.message}`);
  process.exit(1);
}
