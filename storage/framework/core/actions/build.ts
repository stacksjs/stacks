/**
 * Build the @stacksjs/actions package.
 *
 * Every `src/**\/*.ts` file is transpiled 1:1 to a matching `dist/**\/*.js`
 * (NOT bundled). Two consumers depend on that per-file layout surviving:
 *   - `runAction()` shells out to `bun <dist/…>` per command, and
 *   - apps import subpaths directly, e.g.
 *     `@stacksjs/actions/dist/serve/api.js`.
 *
 * Why NOT `Bun.build` bundling: auto-discovering every command as an
 * entrypoint forces `splitting: true`, and Bun's minifier+splitter mangles
 * the barrel/cross-chunk re-exports into `export { x as y }` where `x` is
 * never declared — the "Exported binding 'X' needs to refer to a top-level
 * declared variable" crash that shipped in stacks 0.70.85–0.70.88 and broke
 * every consumer on import. `transpilePackage` (Bun.Transpiler) strips types
 * and leaves each import/export statement verbatim, so the re-exports stay
 * valid and the file structure is preserved. See core/build/src/index.ts for
 * the full rationale — this package is on its "Affected" list.
 */

import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal(['bun', 'bun:*', 'node:*']),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
