import { intro, outro } from '../core/build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./dev.ts'],
  outdir: './dist',
  format: 'esm',
  // sourcemap: 'linked',
  minify: false,
  target: 'bun',
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
