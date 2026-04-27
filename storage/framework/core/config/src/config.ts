import type { StacksOptions } from '@stacksjs/types'
import { defaults } from './defaults'
import { overrides } from './overrides'

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

export const config: StacksOptions = new Proxy({} as StacksOptions, {
  get(_target, prop: string) {
    return readMerged(prop)
  },
  has(_target, prop) {
    return prop in overrides || prop in defaults
  },
  ownKeys() {
    return Array.from(new Set([...Object.keys(overrides), ...Object.keys(defaults)]))
  },
  getOwnPropertyDescriptor(_target, prop) {
    if (typeof prop === 'string' && (prop in overrides || prop in defaults)) {
      return { enumerable: true, configurable: true, writable: true, value: readMerged(prop) }
    }
    return undefined
  },
}) as StacksOptions

// Database config is now initialized lazily in database/utils.ts when first accessed
// This avoids circular dependency issues between config and database packages

export function getConfig(): StacksOptions {
  return config
}

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
export { defaults, overrides }

type AppEnv = 'dev' | 'stage' | 'prod' | string

export function determineAppEnv(): AppEnv {
  if (app.env === 'local' || app.env === 'development')
    return 'dev'

  if (app.env === 'staging')
    return 'stage'

  if (app.env === 'production')
    return 'prod'

  if (!app.env)
    throw new Error('Couldn\'t determine app environment')

  return app.env
}
