import { StacksOptions } from '@stacksjs/types'
import defaults from './defaults'
import overrides from './overrides'
import { defu } from 'defu'

export const config: StacksOptions = defu(overrides, defaults)

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
  ui
} = config

export { defaults, overrides }

export * from './defaults'
export * from './overrides'
export * from './helpers'
