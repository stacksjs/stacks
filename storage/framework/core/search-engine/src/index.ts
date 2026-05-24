import type { SearchEngineDriver } from '@stacksjs/types'
import { overridesReady, searchEngine } from '@stacksjs/config'

export type SearchDriver = 'meilisearch' | 'algolia' | 'opensearch' | 'typesense'

// User `config/search-engine.ts` loads asynchronously via `overridesReady`.
// Without awaiting it here, the first import would read framework defaults
// (`driver: 'opensearch'`) and bind the empty stub driver forever.
await overridesReady

function importDriverModule(driver: string | undefined) {
  if (driver === 'algolia') return import('./drivers/algolia.ts')
  if (driver === 'opensearch') return import('./drivers/opensearch.ts')
  if (driver === 'typesense') return import('./drivers/typesense.ts')
  return import('./drivers/meilisearch.ts')
}

const driverModule = await importDriverModule(searchEngine.driver)
const activeDriver = driverModule.default as SearchEngineDriver

export function useSearchEngine(): SearchEngineDriver {
  return activeDriver
}

export function useAlgolia(): Promise<typeof import('./drivers/algolia').default> {
  return import('./drivers/algolia').then(m => m.default)
}

export function useMeilisearch(): Promise<typeof import('./drivers/meilisearch').default> {
  return import('./drivers/meilisearch').then(m => m.default)
}

export function useOpensearch(): Promise<typeof import('./drivers/opensearch').default> {
  return import('./drivers/opensearch').then(m => m.default)
}

export function useTypesense(): Promise<typeof import('./drivers/typesense').default> {
  return import('./drivers/typesense').then(m => m.default)
}

export * from './documents'
