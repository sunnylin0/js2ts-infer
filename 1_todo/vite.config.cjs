const { defineConfig } = require('vite');
const { vitePlugin } = require('../src/plugins.js');

module.exports = defineConfig({
  plugins: [
    vitePlugin({ port: 9002 })
  ],
  server: {
    port: 5173
  }
});
