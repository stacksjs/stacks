import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  sourcemap: 'linked',

  external: [
    '@stacksjs/types',
    '@stacksjs/tunnel',
    '@stacksjs/env',
    '@stacksjs/path',
    '@stacksjs/validation',
    '@vinejs/compiler',
    'pluralize',
    '@stacksjs/strings',
    'dinero.js',
    '@dinero.js/currencies',
    'validator',
    '@vinejs/vine',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
