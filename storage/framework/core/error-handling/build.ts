import { dts } from 'bun-plugin-dtsx'
import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file (see transpilePackage) instead of bundling: this
// barrel re-exports named bindings that Bun's bundler mangles.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal([]),
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
  result: { errors: [], warnings: [] },
})
