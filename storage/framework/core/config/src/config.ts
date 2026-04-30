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
// In practice that means the named exports return the framework
// defaults, not the user's overrides. They're kept here for
// backwards compatibility — code that needs live, override-aware
// values should read off the `config` proxy directly:
//
//     import { config } from '@stacksjs/config'
//     await overridesReady   // optional: wait for user configs
//     config.ports.api       // reactive, reflects config/ports.ts
//
// The tradeoff was deliberate: making these exports lazy would break
// destructuring (`const { ports } = config` would have the same issue)
// and force every consumer to await config readiness, which is the
// wrong default for cold-path settings that never change.
export const ai: StacksOptions['ai'] = config.ai
export const analytics: StacksOptions['analytics'] = config.analytics
export const app: StacksOptions['app'] = config.app
export const auth: StacksOptions['auth'] = config.auth
export const realtime: StacksOptions['realtime'] = config.realtime
export const cache: StacksOptions['cache'] = config.cache
export const cloud: StacksOptions['cloud'] = config.cloud
export const cli: StacksOptions['cli'] = config.cli
export const database: StacksOptions['database'] = config.database
export const dns: StacksOptions['dns'] = config.dns
export const docs: StacksOptions['docs'] = config.docs
export const email: StacksOptions['email'] = config.email
export const errors: StacksOptions['errors'] = config.errors
export const git: StacksOptions['git'] = config.git
export const hashing: StacksOptions['hashing'] = config.hashing
export const library: StacksOptions['library'] = config.library
export const logging: StacksOptions['logging'] = config.logging
export const notification: StacksOptions['notification'] = config.notification
export const payment: StacksOptions['payment'] = config.payment
export const ports: StacksOptions['ports'] = config.ports
export const queue: StacksOptions['queue'] = config.queue
export const security: StacksOptions['security'] = config.security
export const saas: StacksOptions['saas'] = config.saas
export const searchEngine: StacksOptions['searchEngine'] = config.searchEngine
export const services: StacksOptions['services'] = config.services
export const filesystems: StacksOptions['filesystems'] = config.filesystems
export const team: StacksOptions['team'] = config.team
export const ui: StacksOptions['ui'] = config.ui

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
