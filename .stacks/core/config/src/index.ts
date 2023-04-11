import type { AppOptions, CacheOptions, CliOptions, CronJobOptions, DatabaseOptions, DebugOptions, DnsOptions, EmailOptions, Events, GitOptions, HashingOptions, LibraryOptions, Model, NotificationOptions, PagesOption, PaymentOptions, SearchEngineOptions, ServicesOptions, StorageOptions, UiOptions } from '@stacksjs/types'

export function env(key: string, fallback: any) {
  // console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return fallback
}

export { defineBuildConfig } from 'unbuild'

export function defineAppConfig(options: AppOptions) {
  return options
}

export function defineCacheConfig(options: CacheOptions) {
  return options
}

export function defineCliConfig(options: CliOptions) {
  return options
}

export function defineCronJobsConfig(options: CronJobOptions[]) {
  return options
}

export function defineDatabaseConfig(options: DatabaseOptions) {
  return options
}

export function defineDebugConfig(options: DebugOptions) {
  return options
}

// export function defineCloudConfig(options: CloudOptions) {
//   return options
// }

export function defineDnsConfig(options: DnsOptions) {
  return options
}

export function defineEmailConfig(options: EmailOptions) {
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

export function defineModel(options: Model) {
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
