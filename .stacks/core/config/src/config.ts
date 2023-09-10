import type { StacksOptions } from '@stacksjs/types'
import defaults from './defaults'
import overrides from './overrides'

export const config = {
  ...defaults,
  ...overrides,
}

export const {
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
  ui,
}: StacksOptions = config

export { defaults, overrides }

export * from './defaults'
export * from './overrides'
export * from './helpers'
