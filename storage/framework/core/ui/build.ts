import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file (see transpilePackage) instead of bundling: this
// barrel re-exports named bindings that Bun's bundler mangles.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(['@cwcss/crosswind']),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
