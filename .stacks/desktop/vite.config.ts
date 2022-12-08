import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Unocss from '@unocss/vite'

export default defineConfig({
  clearScreen: false,
  server: {
    port: 4000,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome97', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  plugins: [
    vue(),
    Unocss({
      configFile: 'unocss.config.ts',
      mode: 'vue-scoped',
    }),
  ],
})
