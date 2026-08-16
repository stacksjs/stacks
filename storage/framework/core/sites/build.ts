import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Preserve the package's barrel re-exports. Bun's bundler can emit a bare
// `export { x as publicName }` whose local binding was removed by minification,
// which makes the published package fail during import. The shared transpiler
// keeps each source module and its import/export graph intact.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
