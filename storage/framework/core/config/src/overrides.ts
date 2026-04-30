/**
 * **Overrides**
 *
 * This file is what takes prepares the user config to be merged with
 * the default config. For anyone that uses this, ensure you define
 * the alias `~config/` in your tsconfig.json file.
 */

import type { StacksConfig } from '@stacksjs/types'

// PRODUCTION BINARY MODE: Skip runtime config loading
// When SKIP_CONFIG_LOADING is set, return empty config to avoid parsing external TS files
const skipConfigLoading = process.env.SKIP_CONFIG_LOADING === 'true'

// Anchor `overrides` and the readiness Promise on `globalThis` via well-known
// symbols. Reason: this file gets loaded twice in some module-resolution
// paths (Bun resolves package-relative imports under `@stacksjs/config` along
// a different cache key than the `./overrides` that `config.ts` does
// internally). Without a shared anchor, the proxy in `config.ts` reads from
// instance A while `loadUserConfigs()` mutates instance B, so the Proxy's
// `readMerged()` keeps falling through to defaults forever — the bug that
// made `config.ports.api` return 3008 even after `await overridesReady`.
const OVERRIDES_KEY = Symbol.for('@stacksjs/config:overrides')
const READY_KEY = Symbol.for('@stacksjs/config:overridesReady')

// `overrides` is exported synchronously, populated from `defaultsForOverrides`
// on creation and *mutated in place* by `loadUserConfigs()` once the user's
// `config/*.ts` files finish loading.
//
// Why not top-level `await import('~/config/*.ts')` like before: each user
// config file pulls in framework helpers (e.g. `config/env.ts` imports
// `@stacksjs/validation`). Those helpers eventually import @stacksjs/storage
// → facade.ts → @stacksjs/config — a static cycle that, combined with TLA
// in this file, leaves @stacksjs/router, @stacksjs/email, and any consumer
// that reads `config.<key>` at module-eval time in TDZ. By making this
// module synchronous, the consumer graph evaluates deterministically and
// `loadUserConfigs()` patches in real values asynchronously in the background.
function defaultsForOverrides(): StacksConfig {
  return {
    ai: {},
    analytics: {},
    app: { name: process.env.APP_NAME || 'Stacks', env: process.env.APP_ENV || 'production' },
    cache: {},
    cli: {},
    cloud: {},
    database: {},
    dns: {},
    realtime: {},
    email: {},
    errors: {},
    git: {},
    hashing: {},
    library: {},
    logging: {},
    notification: {},
    queue: {},
    payment: {},
    ports: {},
    saas: {},
    searchEngine: {},
    security: {},
    services: {},
    filesystems: {},
    team: {},
    ui: {},
  } as any
}

// Reuse an existing globalThis anchor if a prior module-load already
// initialized it; otherwise create the shared object now.
const globalScope = globalThis as Record<symbol, unknown>
const sharedOverrides = globalScope[OVERRIDES_KEY] as StacksConfig | undefined
export const overrides: StacksConfig = sharedOverrides ?? (() => {
  const created = defaultsForOverrides()
  globalScope[OVERRIDES_KEY] = created
  return created
})()

// Files we attempt to load. The key on the left is the property name on
// `overrides`; the path on the right is the project-local config file.
const userConfigs: Array<[keyof StacksConfig, string]> = [
  ['ai', '~/config/ai'],
  ['analytics', '~/config/analytics'],
  ['app', '~/config/app'],
  ['cache', '~/config/cache'],
  ['cli', '~/config/cli'],
  ['cloud', '~/config/cloud'],
  ['database', '~/config/database'],
  ['dns', '~/config/dns'],
  ['email', '~/config/email'],
  ['errors', '~/config/errors'],
  ['git', '~/config/git'],
  ['hashing', '~/config/hashing'],
  ['library', '~/config/library'],
  ['logging', '~/config/logging'],
  ['notification', '~/config/notification'],
  ['payment', '~/config/payment'],
  ['ports', '~/config/ports'],
  ['queue', '~/config/queue'],
  ['realtime', '~/config/realtime'],
  ['saas', '~/config/saas'],
  ['searchEngine', '~/config/search-engine'],
  ['security', '~/config/security'],
  ['services', '~/config/services'],
  ['filesystems', '~/config/filesystems'],
  ['team', '~/config/team'],
  ['ui', '~/config/ui'],
]

/**
 * Load the project's `config/*.ts` files into `overrides` in the background.
 * Each module is imported in parallel and merged on top of the synchronous
 * default. Missing files fall back to `{}` silently — projects don't have to
 * ship every config category.
 *
 * Returns a Promise so callers (e.g. `injectGlobalAutoImports`) can await
 * config readiness when they need the real values rather than defaults.
 */
// Shared readiness Promise — the loader runs once per process, even if this
// module is evaluated twice. Without this anchor, two parallel loads each
// kick off their own `loadUserConfigs()` and only one of them mutates the
// `overrides` instance the live config proxy reads from.
const sharedReady = globalScope[READY_KEY] as Promise<StacksConfig> | undefined
export const overridesReady: Promise<StacksConfig> = sharedReady ?? (() => {
  const promise = skipConfigLoading
    ? Promise.resolve(overrides)
    : Promise.all(userConfigs.map(async ([key, modulePath]) => {
      try {
        const mod = await import(modulePath)
        if (mod?.default !== undefined)
          ;(overrides as any)[key] = mod.default
      }
      catch (err: unknown) {
        // Distinguish "file simply doesn't exist" from "file exists but is
        // malformed". The first is the common case (projects don't ship
        // every config category) and is fine to silence. The second is a
        // bug that used to silently fall through to defaults — surface it
        // on stderr so users can spot the typo / syntax error in their
        // config file.
        const code = (err as { code?: string })?.code
        const msg = (err as { message?: string })?.message ?? String(err)
        const isMissing = code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND' || /Cannot find module/i.test(msg)
        if (!isMissing) {
          // eslint-disable-next-line no-console
          console.warn(`[config] Failed to load ${String(key)} config from ${modulePath}: ${msg}`)
        }
      }
    })).then(() => overrides)
  globalScope[READY_KEY] = promise
  return promise
})()

export default overrides
