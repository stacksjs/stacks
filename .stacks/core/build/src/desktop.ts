import { defineConfig } from 'vite'
import { server } from '@stacksjs/server'
import { cssEngine, uiEngine } from './'

export default defineConfig({
  clearScreen: false,

  server,
  // server: {
  //   port: 4000,
  //   strictPort: true,
  // },

  // envPrefix: ['VITE_', 'TAURI_'],
  envPrefix: 'APP_',

  plugins: [
    uiEngine(),
    cssEngine(),
  ],

  build: {
    target: ['es2021', 'chrome97', 'safari13'],
    minify: !process.env.APP_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.APP_DEBUG,
  },
})
