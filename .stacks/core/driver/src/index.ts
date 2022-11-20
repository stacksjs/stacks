import type { SearchEngineDriver } from '@stacksjs/types'

type DriverFactory<T> = (opts?: T) => SearchEngineDriver

export function defineDriver<T = any>(factory: DriverFactory<T>): DriverFactory<T> {
  return factory
}
