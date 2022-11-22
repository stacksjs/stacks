import type { SearchEngineDriver } from './drivers/meilisearch'

export interface CreateSearchEngineOptions {
  driver?: SearchEngineDriver
}

// export function createSearchEngine(options: CreateSearchEngineOptions): SearchEngineDriver {
//   return {}
// }

// function client() {
//   return new MeiliSearch({
//     host: 'http://127.0.0.1:7700',
//     apiKey: 'masterKey',
//   })
// }
