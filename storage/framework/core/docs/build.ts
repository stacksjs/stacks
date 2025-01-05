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
    'vite-plugin-pwa',
    '@vitejs/plugin-vue',
    '@vite-pwa/vitepress',
    'vitepress',
    '@shikijs/vitepress-twoslash',
    '@stacksjs/config',
    '@stacksjs/alias',
    '@stacksjs/path',
    '@stacksjs/server',
    '@stacksjs/env',
    '@stacksjs/cli',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
