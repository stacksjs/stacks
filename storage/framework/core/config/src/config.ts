import type { StacksOptions } from '@stacksjs/types'
import { initializeDbConfig } from '../../database/src/utils'
import { defaults } from './defaults'
import { overrides } from './overrides'

// merged defaults and overrides
export const config: StacksOptions = {
  ...defaults,
  ...overrides,
}

// Initialize the database config to avoid circular dependencies
initializeDbConfig(config)

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
export const storage: StacksOptions['storage'] = config.storage
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
