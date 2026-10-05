import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  minify: true,
  external: frameworkExternal(),
  plugins: [
    dts({
      root: './src',
      outdir: './dist',
    }),
  ],
})

// The narrow schema-declaration entry (and the request validator below) are
// separate entrypoints rather than code-split chunks, so importing one never
// pulls the other's graph - which is the whole point of having it.
const runtimeResult = await Bun.build({
  entrypoints: ['./src/runtime.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  minify: true,
  external: frameworkExternal(),
  plugins: [
    dts({
      root: './src',
      outdir: './dist',
    }),
  ],
})

if (!runtimeResult.success)
  throw new AggregateError(runtimeResult.logs, 'Failed to build the schema-declaration entry')

const requestValidatorResult = await Bun.build({
  entrypoints: ['./src/request-validator.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  minify: true,
  external: frameworkExternal(),
})

if (!requestValidatorResult.success)
  throw new AggregateError(requestValidatorResult.logs, 'Failed to build the request validator entry')

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
