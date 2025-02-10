import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'browser',
  // sourcemap: 'linked',
  external: ['@stacksjs/path', '@stacksjs/error-handling'],
  // minify: true,
  plugins: [dts()],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
