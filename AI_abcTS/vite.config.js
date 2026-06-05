import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';
import path from 'path';

export default defineConfig({
  plugins: [
    commonjs(),
  ],
  build: {
    // 禁用 CSS 代碼拆分，讓樣式跟著打包，或獨立為單一 css
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      name: 'ABCJS',
      formats: ['umd'], // 限定 UMD 格式，對 file:// 最友善
      fileName: () => 'abcjs-basic.js',
    },
    rollupOptions: {
      output: {
        // 強制所有動態引入合併，防止 Code Splitting 產生額外的 ESM 模組，避免 CORS 問題
        inlineDynamicImports: true,
      },
    },
  },
});
