import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  // sourcemap: 'linked',
  external: ['bun'],
  minify: true,
  plugins: [
    dts(),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
