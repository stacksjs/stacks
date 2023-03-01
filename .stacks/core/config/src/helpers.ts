import type { AppOptions, CacheOptions, CliOptions, DatabaseOptions, DebugOptions, DeployOptions, DnsOptions, Events, HashingOptions, LibraryOptions, NotificationOptions, PagesOption, PaymentOptions, SearchEngineOptions, ServicesOptions, StorageOptions, UiOptions } from '@stacksjs/types'
import type { GitOptions } from 'stacks/core/buddy/src'
import * as c from '.'

type Config = 'app' | 'cache' | 'database' | 'debug' | 'deploy' | 'docs' | 'git' | 'hashing' | 'library' | 'notification' | 'searchEngine' | 'services' | 'storage' | 'ui'

export function config(key?: Config, fallback?: any) {
  return key ? c[key] : fallback
}

export function env(key: string, fallback: any) {
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
  if (options?.verbose === true)
    return true

  if (c.app.debug === true)
    return true

  return false
}

export function defineAppConfig(options: AppOptions) {
  return options
}

export function defineCacheConfig(options: CacheOptions) {
  return options
}

export function defineDatabaseConfig(options: DatabaseOptions) {
  return options
}

export function defineDebugConfig(options: DebugOptions) {
  return options
}

export function defineDeployConfig(options: DeployOptions) {
  return options
}

export function defineDnsConfig(options: DnsOptions) {
  return options
}

export function defineEventsConfig(options: Events) {
  return options
}

export function defineGitConfig(options: GitOptions) {
  return options
}

export function defineHashingConfig(options: HashingOptions) {
  return options
}

export function defineLibraryConfig(options: LibraryOptions) {
  return options
}

export function defineNotificationConfig(options: NotificationOptions) {
  return options
}

export function definePageConfig(options: PagesOption) {
  return options
}

export function definePaymentConfig(options: PaymentOptions) {
  return options
}

export function defineSearchEngineConfig(options: SearchEngineOptions) {
  return options
}

export function defineServicesConfig(options: ServicesOptions) {
  return options
}

export function defineStorageConfig(options: StorageOptions) {
  return options
}

export function defineUiConfig(options: UiOptions) {
  return options
}
