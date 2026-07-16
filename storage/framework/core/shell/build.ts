import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file (Bun.Transpiler) instead of bundling with Bun.build:
// the bundler mangles this package's barrel re-exports into invalid
// `export { x as y }` where `x` is never declared — the "Exported binding 'X'
// needs to refer to a top-level declared variable" crash that broke every
// consumer on import (stacks 0.70.85–0.70.88). See core/build/src/index.ts.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(['bun']),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
