/**
 * This file is used to define the types/interfaces used in the project.
 */

import type { SearchEngineStore } from './types'

// import { isString } from '@stacksjs/validation'

export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

export function determineState(): SearchEngineStore {
  const ls = localStorage.getItem('search-engine')

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
