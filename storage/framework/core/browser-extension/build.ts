import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file (see transpilePackage) — this is a barrel that
// re-exports named bindings across modules, which Bun's bundler mangles.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(['bun-plugin-stx']),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
