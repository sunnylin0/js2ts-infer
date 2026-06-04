const { defineConfig } = require('vite');
const { vitePlugin } = require('../dist/plugins.js');

module.exports = defineConfig({
  plugins: [
    vitePlugin({ port: 9002 })
  ],
  server: {
    port: 5173
  }
});
