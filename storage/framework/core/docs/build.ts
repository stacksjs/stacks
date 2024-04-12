import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',

  external: [
    'vitepress',
    '@stacksjs/config',
    '@stacksjs/alias',
    '@stacksjs/path',
    '@stacksjs/server',
    '@stacksjs/env',
    '@stacksjs/cli',
    '@vite-pwa/vitepress',
    'vitepress-plugin-twoslash',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
