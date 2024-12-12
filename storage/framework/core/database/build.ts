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
    '@stacksjs/config',
    '@stacksjs/faker',
    '@stacksjs/path',
    '@stacksjs/cli',
    '@stacksjs/logging',
    '@stacksjs/query-builder',
    '@stacksjs/storage',
    '@stacksjs/strings',
    '@stacksjs/utils',
    'bun',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
