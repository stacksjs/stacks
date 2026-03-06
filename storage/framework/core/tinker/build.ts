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
  minify: true,
  external: [
    '@stacksjs/database',
    '@stacksjs/orm',
    '@stacksjs/config',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/validation',
    '@stacksjs/cli',
    '@stacksjs/collections',
    '@stacksjs/strings',
    '@stacksjs/cache',
    '@stacksjs/queue',
    '@stacksjs/events',
    '@stacksjs/router',
    '@stacksjs/auth',
    '@stacksjs/notifications',
    '@stacksjs/env',
  ],
  plugins: [
    dts({
      root: '.',
      outdir: './dist',
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
