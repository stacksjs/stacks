import type { SearchEngineDriverFactory } from '@stacksjs/types'

export function defineSearchEngineDriver<T = any>(factory: SearchEngineDriverFactory<T>): SearchEngineDriverFactory<T> {
  return factory
}

// type DatabaseDriverFactory<T> = (opts?: T) => DatabaseDriver
// export function defineDatabaseDriver<T = any>(factory: DatabaseDriverFactory<T>): DatabaseDriverFactory<T> {
//   return factory
// }
