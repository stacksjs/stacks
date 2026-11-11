import { rm } from 'node:fs/promises'
import { dts } from '@dtsx/bun'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

await rm(new URL('./dist', import.meta.url), { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
  external: frameworkExternal(),
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
