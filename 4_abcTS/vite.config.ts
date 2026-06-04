import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';
import path from 'path';
// import { vitePlugin } from '../src/plugins.js';

export default defineConfig({
  plugins: [
    commonjs(),
    // vitePlugin({ port: 9002 })
  ],
  build: {
    // 禁用 CSS 代碼拆分，讓樣式跟著打包，或獨立為單一 css
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'index.js'),
      name: 'ABCJS',
      formats: ['umd'], // 限定 UMD 格式，對 file:// 最友善
      fileName: () => 'abcjs-basic.js',
    },
    /* 🛠️ 加上 server 設定 */
    server: {
      open: '/editor.html' // 👈 啟動時自動在瀏覽器打開 editor.html
    },
    rollupOptions: {
      output: {
        // 強制所有動態引入合併，防止 Code Splitting 產生額外的 ESM 模組，避免 CORS 問題
        inlineDynamicImports: true,
      },
    },
  },
});
