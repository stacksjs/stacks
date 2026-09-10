import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file instead of bundling. The barrel re-exports bun-queue's
// named bindings (`export * from './bun-queue'`), and Bun's minifying bundler
// mangles those into `export { x as y }` where `x` is never declared - the
// "cannot be imported" failure `validateRuntimeExports` catches. It is the same
// reason `auth` and `browser` transpile.
//
// It also means every source file gets a dist file, so `./drivers/redis` - which
// `getRedisQueue()` imports at runtime - exists without being listed anywhere.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
