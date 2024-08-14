import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  sourcemap: 'linked',

  external: ['@stacksjs/collections', '@stacksjs/types', '@stacksjs/utils', '@stacksjs/validation'],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
