import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file (see transpilePackage) instead of bundling: this
// barrel re-exports named bindings from external sources (e.g.
// `export { useOnline } from '@stacksjs/composables'`) that Bun's bundler
// drops/mangles, so the published dist ends up missing those named exports.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
