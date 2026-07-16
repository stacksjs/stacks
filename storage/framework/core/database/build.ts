import { frameworkExternal, intro, outro, transpilePackage } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

// Transpile file-by-file (Bun.Transpiler) instead of bundling with Bun.build:
// the bundler mangles this package's barrel re-exports into invalid
// `export { x as y }` where `x` is never declared — the "Exported binding 'X'
// needs to refer to a top-level declared variable" crash that broke every
// consumer on import (stacks 0.70.85–0.70.88). See core/build/src/index.ts.
// `dynamodb-tooling` (pulled in transitively) lazy-imports `confbox/*`
// subpaths that Bun can't resolve at build time; externalizing the tooling
// (and those subpaths) keeps the .d.ts pass from failing on them — they
// resolve from the consumer's node_modules at runtime like any other dep.
await transpilePackage({
  dir: import.meta.dir,
  external: frameworkExternal([
    'bun',
    'dynamodb-tooling',
    'confbox',
    'confbox/yaml',
    'confbox/jsonc',
    'confbox/json5',
    'confbox/toml',
  ]),
})

await outro({
  dir: import.meta.dir,
  startTime,
  result: { errors: [], warnings: [] },
})
