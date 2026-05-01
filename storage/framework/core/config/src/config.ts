import type { StacksOptions } from '@stacksjs/types'
import { defaults } from './defaults'
import { overrides, overridesReady } from './overrides'

// merged defaults and overrides
//
// `overrides` is mutated in the background by `overridesReady` after the
// project's `config/*.ts` files load (see `./overrides.ts` for why we no
// longer block module evaluation on top-level await). Spreading once would
// freeze a snapshot of the empty-default state, so consumers reading
// `config.email.default` later would see `undefined`. A Proxy that reads
// `overrides[key]` first and falls back to `defaults[key]` on every access
// keeps the export reactive without exposing the loading mechanism.
function readMerged(prop: string): unknown {
  // `overrides` is initialized synchronously with empty objects in
  // `defaultsForOverrides()`, so a hit here always wins over `defaults`
  // for any key the user has actually customized. Once user configs land,
  // the same key returns the populated user object via this same accessor.
  const o = (overrides as any)[prop]
  if (o !== undefined && (typeof o !== 'object' || Object.keys(o).length > 0)) {
    return o
  }
  return (defaults as any)[prop]
}

// Expose `config` as a Proxy of a function target. Two non-obvious things
// going on here:
//
// 1) The target is a function, not `{}`. Both Bun and V8 have aggressive
//    inline-cache paths for plain-object proxy targets — the first
//    property access ends up sealing the target and any subsequent reads
//    skip the trap, returning whatever the first call produced.
//    Functions don't go through that fast path.
//
// 2) We define the full set of traps the engine queries during property
//    access (`get`, `has`, `getOwnPropertyDescriptor`, `ownKeys`,
//    `isExtensible`, `getPrototypeOf`). Without our own
//    `isExtensible`/`preventExtensions` traps, the engine can decide the
//    target is non-extensible (because the function target started with
//    no own properties) and freeze further access. Returning `true` from
//    `isExtensible` and refusing `preventExtensions` forces a fresh trap
//    invocation on every read.
//
// The combined effect: `config.ports.api` re-evaluates `readMerged` every
// time, so once `overridesReady` resolves, the ports values from
// `config/ports.ts` are immediately visible.
const proxyTarget = function configProxyTarget() { /* unused */ } as unknown as StacksOptions
export const config: StacksOptions = new Proxy(proxyTarget, {
  get(_t, prop: string) {
    return readMerged(prop)
  },
  has(_t, prop) {
    return prop in overrides || prop in defaults
  },
  ownKeys() {
    return Array.from(new Set([
      ...Object.keys(overrides as object),
      ...Object.keys(defaults as object),
    ]))
  },
  getOwnPropertyDescriptor(_t, prop) {
    if (typeof prop !== 'string') return undefined
    if (!(prop in (overrides as object)) && !(prop in (defaults as object))) return undefined
    return {
      enumerable: true,
      configurable: true,
      writable: true,
      value: readMerged(prop),
    }
  },
  // Force the target to remain extensible. Without this, the engine can
  // freeze the target after the first descriptor query and short-circuit
  // future reads — which is exactly the bug we hit with the previous
  // empty-object proxy target.
  isExtensible() {
    return true
  },
  preventExtensions() {
    return false
  },
}) as StacksOptions

// Database config is now initialized lazily in database/utils.ts when first accessed
// This avoids circular dependency issues between config and database packages

export function getConfig(): StacksOptions {
  return config
}

// Per-section convenience exports.
//
// Caveat: these are *snapshots* taken at module-load time. ESM `export
// const x = expr` evaluates `expr` once and binds `x` to that result —
// there's no language-level way to make a named export re-evaluate
// per access. So `import { ports } from '@stacksjs/config'` returns
// whatever `config.ports` was when the config module first evaluated,
// which is *before* `overridesReady` resolves and the user's
// `config/*.ts` files land.
//
// These start as snapshots of the framework defaults (because the user's
// `config/*.ts` haven't loaded yet — see `overridesReady`). Once the
// async loader resolves we reassign each `let` binding so consumers of
// `import { ports } from '@stacksjs/config'` see the merged value.
//
// ESM live bindings make this work: when an exporting module reassigns
// a `let`-bound export, every importer immediately sees the new value
// (no re-import needed). The earlier `export const x = config.x` form
// captured the empty-default snapshot forever.
//
// Caveat: code that destructures (`const { ports } = config` or reads
// at the top of a function) before `overridesReady` resolves still
// gets the early snapshot. For correctness in that path, read off
// the `config` proxy: `config.ports.api` always pulls live.
export let ai: StacksOptions['ai'] = config.ai
export let analytics: StacksOptions['analytics'] = config.analytics
export let app: StacksOptions['app'] = config.app
export let auth: StacksOptions['auth'] = config.auth
export let realtime: StacksOptions['realtime'] = config.realtime
export let cache: StacksOptions['cache'] = config.cache
export let cloud: StacksOptions['cloud'] = config.cloud
export let cli: StacksOptions['cli'] = config.cli
export let dashboard: StacksOptions['dashboard'] = config.dashboard
export let database: StacksOptions['database'] = config.database
export let dns: StacksOptions['dns'] = config.dns
export let docs: StacksOptions['docs'] = config.docs
export let email: StacksOptions['email'] = config.email
export let errors: StacksOptions['errors'] = config.errors
export let git: StacksOptions['git'] = config.git
export let hashing: StacksOptions['hashing'] = config.hashing
export let library: StacksOptions['library'] = config.library
export let logging: StacksOptions['logging'] = config.logging
export let notification: StacksOptions['notification'] = config.notification
export let payment: StacksOptions['payment'] = config.payment
export let ports: StacksOptions['ports'] = config.ports
export let queue: StacksOptions['queue'] = config.queue
export let security: StacksOptions['security'] = config.security
export let saas: StacksOptions['saas'] = config.saas
export let searchEngine: StacksOptions['searchEngine'] = config.searchEngine
export let services: StacksOptions['services'] = config.services
export let filesystems: StacksOptions['filesystems'] = config.filesystems
export let team: StacksOptions['team'] = config.team
export let ui: StacksOptions['ui'] = config.ui

// When the user's `config/*.ts` files finish loading, refresh every
// section export. Importers that did `import { ports }` will see the
// post-merge value via ESM live bindings.
overridesReady.then(() => {
  ai = config.ai
  analytics = config.analytics
  app = config.app
  auth = config.auth
  realtime = config.realtime
  cache = config.cache
  cloud = config.cloud
  cli = config.cli
  dashboard = config.dashboard
  database = config.database
  dns = config.dns
  docs = config.docs
  email = config.email
  errors = config.errors
  git = config.git
  hashing = config.hashing
  library = config.library
  logging = config.logging
  notification = config.notification
  payment = config.payment
  ports = config.ports
  queue = config.queue
  security = config.security
  saas = config.saas
  searchEngine = config.searchEngine
  services = config.services
  filesystems = config.filesystems
  team = config.team
  ui = config.ui
}).catch(() => {
  // Loader errors surface from `overrides.ts` already; swallow here so a
  // failed user config doesn't bring down every importer of the section
  // exports — they'll just keep the framework defaults.
})

export * from './helpers'
export { defaults, overrides, overridesReady }

type AppEnv = 'dev' | 'stage' | 'prod' | string

export function determineAppEnv(): AppEnv {
  // Read off the live proxy, not the snapshot `app` const above — when
  // this is called from CLI commands the config module evaluated long
  // before the user's app config landed, and we want the live value.
  const env = (config as { app?: { env?: string } }).app?.env
  if (env === 'local' || env === 'development')
    return 'dev'

  if (env === 'staging')
    return 'stage'

  if (env === 'production')
    return 'prod'

  if (!env)
    throw new Error('Couldn\'t determine app environment')

  return env
}
