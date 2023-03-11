import { defineConfig } from 'vite'
import generateSitemap from 'vite-ssg-sitemap'
import { autoImports, components, cssEngine, inspect, uiEngine } from '@stacksjs/build'
import { alias } from '../../alias'

export default defineConfig({

  clearScreen: false,

  server: {
    // port: app.port,
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  envPrefix: ['VITE_', 'TAURI_'],
  optimizeDeps: {
    exclude: ['vue'],
  },
  plugins: [
    // preview(),
    uiEngine(),
    cssEngine(),
    autoImports(),
    components(),
    inspect(),
  ],

  // https://github.com/vitest-dev/vitest
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
    deps: {
      inline: ['@vue', '@vueuse', 'vue-demi'],
    },
  },

  // https://github.com/antfu/vite-ssg
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    onFinished() { generateSitemap() },
  },

  ssr: {
    // TODO: workaround until they support native ESM
    noExternal: ['workbox-window', /vue-i18n/],
  },
})
