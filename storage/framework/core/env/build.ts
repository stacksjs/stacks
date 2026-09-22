import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Preserve the module graph file-for-file so the root, runtime, and plugin
// entries share the same proxy and private-key caches. Bundling each entry
// separately creates duplicate module instances, while cross-entry splitting
// is unsafe for re-export barrels on current Bun releases.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
