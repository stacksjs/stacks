import type { StacksOptions } from '@stacksjs/types'
import defaults from './defaults'
import overrides from './overrides'

// merged defaults and overrides
export const config: StacksOptions = {
  ...defaults,
  ...overrides,
}

export const {
  ai,
  analytics,
  api,
  app,
  cache,
  cloud,
  cli,
  database,
  dns,
  docs,
  email,
  errors,
  git,
  hashing,
  library,
  logger,
  notification,
  payment,
  ports,
  queue,
  security,
  searchEngine,
  services,
  storage,
  team,
  ui,
}: StacksOptions = config

export { defaults, overrides }

export * from './helpers'

export const determineAppEnv = (): string => {
  if (app.env === 'local') return 'dev'
  if (app.env === 'development') return 'dev'
  if (app.env === 'staging') return 'stage'
  if (app.env === 'production') return 'prod'

  return app.env
}
