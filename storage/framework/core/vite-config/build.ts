import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,

  external: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/env',
    '@stacksjs/error-handling',
    '@stacksjs/path',
    '@stacksjs/server',
    '@stacksjs/types',
    '@stacksjs/utils',
    '@stacksjs/vite-plugin',
    'export-size',
    'hookable',
    'js-yaml',
    'macroable',
    'neverthrow',
    'perfect-debounce',
    'vue',
    'vueuse',
    'yaml',
    'vite',
    'vite-plugin-inspect',
    'vite-plugin-layouts',
    'vite-ssg-sitemap',
    'vitepress',
    'vite-plugin-pwa',
    'vite-plugin-vue-devtools',
    'unocss',
    '@vitejs/plugin-vue',
    'unplugin-auto-import/vite',
    'unplugin-vue-components/vite',
    'unplugin-vue-markdown/vite',
    'unplugin-vue-router',
    'unplugin-vue-router/vite',
    '@intlify/unplugin-vue-i18n/vite',
    'defu',
    '@shikijs/markdown-it',
    'markdown-it-link-attributes',
    'unocss/vite',
    '@unhead/vue',
    'bun',
  ],
  plugins: [
    dts({
      root: './src',
      outdir: './dist',
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
