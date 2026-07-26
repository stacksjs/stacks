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
  // sourcemap: 'linked',
  minify: true,
  plugins: [
    // Ship declarations: without them every consumer of this package sees
    // `any`, which is how a typed framework silently stops being typed.
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
