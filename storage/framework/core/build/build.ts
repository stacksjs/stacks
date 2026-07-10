import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from './src'

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
  plugins: [dts({ root: './src', outdir: './dist' })],
  external: ['bun', '@stacksjs/path', '@stacksjs/storage', '@stacksjs/cli'],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
