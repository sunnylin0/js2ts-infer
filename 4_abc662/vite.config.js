import { defineConfig } from 'vite';
import commonjs from 'vite-plugin-commonjs';
import path from 'path';
import { vitePlugin } from '../src/plugins.js';
import dts from 'vite-plugin-dts'; // 👈 1. 引入 dts 外掛

export default defineConfig({
	plugins: [
		commonjs(),
		vitePlugin({ port: 9002 }),
		// 👈 2. 加入 dts 設定
		dts({
			tsconfigPath: './tsconfig.json', // 指定你的 tsconfig
			rollupTypes: true,               // 關鍵：因為你打包成單一 UMD 檔案，這會把所有 200 多個 JS 的型別「濃縮合併」成一根 index.d.ts，不會散落一地
			insertTypesEntry: true,          // 自動在 package.json 寫入型別進入點
		})
	],
	/* 🛠️ 加上 server 設定 */
	server: {
		open: '/editor.html' // 啟動時自動在瀏覽器打開 editor.html
	},
	build: {
		// 關閉壓縮 (預設是 'esbuild')
		minify: false,
		// 禁用 CSS 代碼拆分，讓樣式跟著打包，或獨立為單一 css
		cssCodeSplit: false,
		lib: {
			entry: path.resolve(__dirname, 'index.js'),
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