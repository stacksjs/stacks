import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({ dir: import.meta.dir })

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'browser',
  minify: true,
  external: frameworkExternal(),
  plugins: [dts({ root: './src', outdir: './dist', bundle: true })],
})

await outro({ dir: import.meta.dir, startTime, result })

const testing = await Bun.build({
  entrypoints: ['./src/testing.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  external: frameworkExternal(),
  plugins: [dts({ root: './src', outdir: './dist', bundle: true })],
})
if (!testing.success) throw new Error(`Mobile testing build failed: ${testing.logs.join('\n')}`)
