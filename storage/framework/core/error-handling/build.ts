import { dts } from 'bun-plugin-dts-auto'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  sourcemap: 'linked',
  minify: true,
  external: ['@stacksjs/cli', '@stacksjs/path'],
  plugins: [dts()],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
