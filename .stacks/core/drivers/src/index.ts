import type { SearchEngineDriver } from '@stacksjs/types'

type SearchEngineDriverFactory<T> = (opts?: T) => SearchEngineDriver
export function defineSearchEngineDriver<T = any>(factory: SearchEngineDriverFactory<T>): SearchEngineDriverFactory<T> {
  return factory
}

// type DatabaseDriverFactory<T> = (opts?: T) => DatabaseDriver
// export function defineDatabaseDriver<T = any>(factory: DatabaseDriverFactory<T>): DatabaseDriverFactory<T> {
//   return factory
// }
