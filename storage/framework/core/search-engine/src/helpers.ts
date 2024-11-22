/**
 * This file is used to define the types/interfaces used in the project.
 */

import { cache } from '@stacksjs/cache'
import type { SearchEngineStore } from './types'

// import { isString } from '@stacksjs/validation'

export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

export function determineState(): SearchEngineStore {
  const ls = cache.get('search-engine')

  if (isString(ls))
    return JSON.parse(ls) as SearchEngineStore

  return {
    // default state
    source: 'http://127.0.0.1:7700',
    index: '',
    perPage: 20,
    currentPage: 1,
    query: '',
  }
}
