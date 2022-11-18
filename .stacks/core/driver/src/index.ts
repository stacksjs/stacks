import type { Driver } from '@stacksjs/types'

type DriverFactory<T> = (opts?: T) => Driver

export function defineDriver<T = any>(factory: DriverFactory<T>): DriverFactory<T> {
  return factory
}
