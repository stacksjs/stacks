import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Wildcard exports need runtime modules beside their declarations. Bundling
// only index left transfer-observation and retry-after without their .js files.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal([]),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
