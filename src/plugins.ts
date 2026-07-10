import { transformSync } from '@babel/core';
// @ts-ignore
import customBabelPlugin from './babel-plugin-js2ts';

/**
 * 用於 Vite 開發環境下的型別側錄與自動插樁插件。
 * 
 * @description
 * 1. 僅在 `vite serve` 開發伺服器模式下生效。
 * 2. 透過 `transformIndexHtml` 鉤子在 HTML 的 `<head>` 最前端自動注入下載側錄代理腳本 (`tracker.js`) 的 `<script>`。
 * 3. 透過 `transform` 鉤子攔截並對所有專案內部的 JS/JSX 檔案進行 Babel 轉譯，插樁注入型別側錄 Proxy。
 * 
 * @example
 * // vite.config.js
 * import { vitePlugin } from 'js2ts-infer/plugins';
 * export default {
 *   plugins: [vitePlugin({ port: 9002 })]
 * };
 * 
 * @param {any} [options={}] - 插件配置選項。
 * @param {number} [options.port=9002] - 型別側錄伺服器的連接埠。
 * @returns {object} 返回符合 Vite Plugin 規格的插件對象。
 */
export function vitePlugin(options: any = {}) {
  const port = options.port || 9002;
  return {
    name: 'vite-plugin-js2ts-infer',
    apply: 'serve' as const, // 僅在開發伺服器啟用
    
    // 自動在 HTML 中注入全域 typeTracker
    transformIndexHtml(html: string) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            children: `
              if (typeof globalThis.__typeTracker === 'undefined') {
                const noop = function(id, val) { return val; };
                noop.enter = function() {};
                noop.exit = function() {};
                globalThis.__typeTracker = noop;
              }
            `,
            injectTo: 'head-prepend' as const
          },
          {
            tag: 'script',
            attrs: { src: `http://localhost:${port}/tracker.js` },
            injectTo: 'head-prepend' as const
          }
        ]
      };
    },

    transform(code: string, id: string) {
      // 排除 node_modules 與非 JS 檔案
      if (id.includes('node_modules') || (!id.endsWith('.js') && !id.endsWith('.jsx'))) {
        return null;
      }

      try {
        const result = transformSync(code, {
          filename: id,
          plugins: [customBabelPlugin],
          sourceMaps: true,
          babelrc: false,
          configFile: false
        });

        return {
          code: result?.code || '',
          map: result?.map || null
        };
      } catch (err: any) {
        console.error(`❌ [vite-plugin-js2ts-infer] 插樁失敗: ${id}, 錯誤: ${err.message}`);
        return null;
      }
    }
  };
}

/**
 * 用於 Webpack 建置管線下的型別側錄與自動插樁 Loader。
 * 
 * @description
 * 攔截 Webpack 處理的資源路徑，排除 `node_modules`。
 * 對專案原始碼使用 Babel 執行動態插樁，注入型別偵測 Proxy，並維持 Source Map 的映射關係。
 * 
 * @example
 * // webpack.config.js
 * module.exports = {
 *   module: {
 *     rules: [
 *       {
 *         test: /\.js$/,
 *         exclude: /node_modules/,
 *         use: ['js2ts-infer/plugins/webpackLoader']
 *       }
 *     ]
 *   }
 * };
 * 
 * @param {string} source - 待處理的檔案原始碼內容。
 * @param {any} map - 傳入的 Source Map 映射資料。
 * @param {any} meta - Webpack 傳遞的元數據。
 * @returns {void} 本方法不直接回傳值，而是透過 Webpack Loader 內建的 `this.callback` 返回結果。
 */
export function webpackLoader(this: any, source: string, map: any, meta: any) {
  if (this.resourcePath.includes('node_modules')) {
    return this.callback(null, source, map, meta);
  }

  try {
    const result = transformSync(source, {
      filename: this.resourcePath,
      plugins: [customBabelPlugin],
      inputSourceMap: map,
      sourceMaps: true,
      babelrc: false,
      configFile: false
    });

    this.callback(null, result?.code || '', result?.map || null, meta);
  } catch (err: any) {
    this.emitError(err);
    this.callback(err, source, map, meta);
  }
}
