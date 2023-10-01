import type { StacksOptions } from '@stacksjs/types'
import defaults from './defaults'
import overrides from './overrides'

export const config: StacksOptions = {
  ...defaults,
  ...overrides,
}

export const {
  analytics,
  api,
  app,
  binary,
  cache,
  cloud,
  database,
  dns,
  docs,
  email,
  git,
  hashing,
  library,
  notification,
  payment,
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
