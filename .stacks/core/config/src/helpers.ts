import type { CliOptions } from '@stacksjs/types'
import * as c from '.'

type Config = 'app' | 'cache' | 'database' | 'debug' | 'deploy' | 'docs' | 'git' | 'hashing' | 'library' | 'notification' | 'searchEngine' | 'services' | 'storage' | 'ui'

export function config(key?: Config, fallback?: any) {
  return key ? c[key] : fallback
}

export function env(key: string, fallback: string) {
  // console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return fallback
}

/**
 * Determines the level of debugging.
 * @param options
 */
export function determineDebugMode(options?: CliOptions) {
  if (options?.debug === true)
    return true

  if (app.debug === true)
    return true

  return false
}
