/**
 * Subprocess fixture for db-config-race.test.ts.
 *
 * `ensureConfigLoaded()` in `../src/utils.ts` used to call
 * `initializeDbConfig(config)` right after the dynamic `import('@stacksjs/config')`
 * settled, without waiting for `overridesReady` — the promise that signals the
 * project's own `~/config/database.ts` has actually finished loading. Since
 * `config.database` is a Proxy read that falls back to the framework default
 * until `overridesReady` resolves (see `readMerged()` in
 * `@stacksjs/config/src/config.ts`), a fast reader could lock in the default
 * connection settings before the project override ever landed — and never
 * retry, since `_dbInstance`/`dbConfig` are only reset from inside
 * `initializeDbConfig` itself.
 *
 * `@stacksjs/config`'s `overridesReady` is pinned to a `globalThis` symbol
 * and resolves at most once per process (`bun test` shares one module
 * registry across files), so the race can't be reproduced by importing
 * `../src/utils` from a normal test file: by the time any test runs, some
 * earlier import has already resolved everything. This fixture runs in a
 * fresh subprocess instead, pre-seeding the same `globalThis` symbol
 * anchors `@stacksjs/config/src/overrides.ts` uses for cross-module
 * coordination, so we can control exactly when the "project config" becomes
 * available without needing a real project directory + `~` alias setup.
 *
 * Run from inside the database package tree (not repo root) so the root
 * `bunfig.toml`'s top-level `preload` (which boots the full framework,
 * including the real `@stacksjs/config`) never fires — that would populate
 * the real `overrides`/`overridesReady` globals before this file's own code
 * gets a chance to seed the fake ones.
 */

const OVERRIDES_KEY = Symbol.for('@stacksjs/config:overrides')
const READY_KEY = Symbol.for('@stacksjs/config:overridesReady')
const globalScope = globalThis as Record<symbol, unknown>

// Mirrors `defaultsForOverrides()`'s untouched `database: {}` placeholder —
// the state before the project's `config/database.ts` has loaded.
const overrides: Record<string, unknown> = { database: {} }
globalScope[OVERRIDES_KEY] = overrides

let resolveReady: (value: unknown) => void = () => {}
const overridesReady = new Promise((resolve) => {
  resolveReady = resolve
})
globalScope[READY_KEY] = overridesReady

const PROJECT_SQLITE_PATH = '/project/configured.sqlite'

// Simulate the project's `config/database.ts` landing some time after boot —
// comfortably longer than the cold `import('@stacksjs/config')` itself
// takes to resolve (single-digit ms once modules are on disk), so a naive
// reader racing ahead of `overridesReady` reliably observes the empty
// placeholder above instead of this value.
setTimeout(() => {
  overrides.database = {
    default: 'sqlite',
    connections: { sqlite: { database: PROJECT_SQLITE_PATH } },
  }
  resolveReady(overrides)
}, 500)

const { ensureDatabaseConfigLoaded } = await import('../../src/utils')
await ensureDatabaseConfigLoaded()

const { config: qbConfig } = await import('@stacksjs/query-builder')

// eslint-disable-next-line no-console
console.log(JSON.stringify({ resolvedSqlitePath: qbConfig.database?.database }))
