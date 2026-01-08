import type { SearchEngineDriver } from '@stacksjs/types'
import { searchEngine } from '@stacksjs/config'
import meilisearch from './drivers/meilisearch'
import algolia from './drivers/algolia'

export type SearchDriver = 'meilisearch' | 'algolia'

function getDriver(): SearchEngineDriver | typeof algolia {
  const driver = searchEngine.driver || 'meilisearch'

  switch (driver) {
    case 'algolia':
      return algolia
    case 'meilisearch':
    default:
      return meilisearch
  }
}

export function useSearchEngine(): SearchEngineDriver {
  return getDriver() as SearchEngineDriver
}

export function useAlgolia(): typeof algolia {
  return algolia
}

export function useMeilisearch(): typeof meilisearch {
  return meilisearch
}

export * from './documents'
export { algolia, meilisearch }
