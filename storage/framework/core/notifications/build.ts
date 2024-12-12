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
    '@stacksjs/chat',
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/email',
    '@stacksjs/error-handling',
    '@stacksjs/push',
    '@stacksjs/sms',
    '@stacksjs/types',
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
