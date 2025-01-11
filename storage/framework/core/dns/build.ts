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
    '@stacksjs/enums',
    '@stacksjs/config',
    '@stacksjs/storage',
    '@stacksjs/error-handling',
    '@stacksjs/actions',
    '@stacksjs/strings',
    '@stacksjs/logging',
    '@stacksjs/path',
    '@stacksjs/error-handling',
    '@stacksjs/whois',
    '@stacksjs/types',
  ],

  plugins: [dts()],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
