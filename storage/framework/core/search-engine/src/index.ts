import type { SearchEngineDriver } from '@stacksjs/types'
import { overridesReady, searchEngine } from '@stacksjs/config'

export type SearchDriver = 'meilisearch' | 'algolia' | 'opensearch' | 'typesense'

function importDriverModule(driver: string | undefined) {
  if (driver === 'algolia') return import('./drivers/algolia.ts')
  if (driver === 'opensearch') return import('./drivers/opensearch.ts')
  if (driver === 'typesense') return import('./drivers/typesense.ts')
  return import('./drivers/meilisearch.ts')
}

/**
 * The active driver, once the user's config has loaded and the driver module it
 * names has been imported.
 *
 * User `config/search-engine.ts` loads asynchronously via `overridesReady`.
 * Reading `searchEngine.driver` before that settles gives the framework default
 * (`opensearch`) and binds the empty stub driver forever, so the wait is real.
 *
 * It used to be a top-level `await`, which cost two things. A top-level await in
 * a published entrypoint breaks a consumer's binary build, and it is a statement
 * where a `.d.ts` may hold only declarations - so this package shipped a
 * declaration file that TypeScript rejected with TS1036, taking every type in it
 * down. Starting the work at module load without awaiting it keeps the timing
 * and loses both problems.
 */
let resolvedDriver: SearchEngineDriver | undefined

const driverReady: Promise<SearchEngineDriver> = (async () => {
  await overridesReady
  const driverModule = await importDriverModule(searchEngine.driver)
  resolvedDriver = driverModule.default as SearchEngineDriver
  return resolvedDriver
})()

/**
 * The search engine driver named by the user's config.
 *
 * Still synchronous, and still destructurable - `const { addDocument } =
 * useSearchEngine()` reads exactly as it did. Every method on the driver already
 * returned a promise, so until the config settles each one resolves through
 * {@link driverReady} and behaves the same from the caller's side. Once it has
 * settled the real member is handed back directly, which keeps the two
 * synchronous members, `client` and `resetClient`, synchronous.
 *
 * Use {@link searchEngineReady} to wait for the driver explicitly.
 */
export function useSearchEngine(): SearchEngineDriver {
  return new Proxy({} as SearchEngineDriver, {
    get(_target, prop: string | symbol) {
      if (resolvedDriver)
        return Reflect.get(resolvedDriver as object, prop)

      return (...args: unknown[]) => driverReady.then((driver) => {
        const member = Reflect.get(driver as object, prop)
        return typeof member === 'function' ? member.apply(driver, args) : member
      })
    },
  })
}

/** Resolves once the configured driver is loaded and bound. */
export function searchEngineReady(): Promise<SearchEngineDriver> {
  return driverReady
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
