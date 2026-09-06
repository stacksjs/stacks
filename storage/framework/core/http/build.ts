import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  // sourcemap: 'linked',
  minify: true,
  plugins: [
    // Ship declarations. `package.json` points `types` at `dist/index.d.ts`
    // and nothing emitted it, so the published tarball held `dist/index.js`
    // and no types at all - every consumer of this package saw `any`, which is
    // how a typed framework silently stops being typed.
    dts({
      root: './src',
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
