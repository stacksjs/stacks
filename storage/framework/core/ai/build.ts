import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  root: './src',
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  // sourcemap: 'linked',
  target: 'bun',
  minify: true,
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
