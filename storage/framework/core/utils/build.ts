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
    '@stacksjs/logging',
    '@stacksjs/arrays',
    '@stacksjs/collections',
    '@stacksjs/config',
    '@stacksjs/enums',
    '@stacksjs/env',
    '@stacksjs/error-handling',
    '@stacksjs/objects',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/types',
    '@stacksjs/validation',
    '@stacksjs/strings',
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
