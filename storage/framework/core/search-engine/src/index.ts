import type { SearchEngineDriver } from '@stacksjs/types'

import meilisearch from './drivers/meilisearch'

function client(): any {
  return meilisearch
}

export function useSearchEngine(): SearchEngineDriver {
  return client()
}

export * from './documents'
