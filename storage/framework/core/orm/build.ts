import { dts } from 'bun-plugin-dtsx'
import { rm } from 'node:fs/promises'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

await rm('./dist', { recursive: true, force: true })

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
      root: '.',
      outdir: './dist',
      exclude: ['tests/**'],
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
