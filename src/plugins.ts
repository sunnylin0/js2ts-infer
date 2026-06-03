import { transformSync } from '@babel/core';
// @ts-ignore
import customBabelPlugin from './babel-plugin-js2ts';

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
