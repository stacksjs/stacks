import type { AppOptions, CacheOptions, CliOptions, CronJobOptions, DatabaseOptions, DebugOptions, DnsOptions, EmailOptions, Events, GitOptions, HashingOptions, LibraryOptions, Model, NotificationOptions, PagesOption, PaymentOptions, SearchEngineOptions, ServicesOptions, StorageOptions, UiOptions } from '@stacksjs/types'

export function env(key: string, fallback: any) {
  // console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return fallback
}

export { defineBuildConfig } from 'unbuild'

export function defineApp(options: AppOptions) {
  return options
}

export function defineCache(options: CacheOptions) {
  return options
}

export function defineCli(options: CliOptions) {
  return options
}

export function defineCronJobsConfig(options: CronJobOptions[]) {
  return options
}

export function defineDatabase(options: DatabaseOptions) {
  return options
}

export function defineDebugConfig(options: DebugOptions) {
  return options
}

// export function defineCloudConfig(options: CloudOptions) {
//   return options
// }

export function defineDns(options: DnsOptions) {
  return options
}

export function defineEmailConfig(options: EmailOptions) {
  return options
}

export function defineEvents(options: Events) {
  return options
}

export function defineGit(options: GitOptions) {
  return options
}

export function defineHashing(options: HashingOptions) {
  return options
}

export function defineLibrary(options: LibraryOptions) {
  return options
}

export function defineModel(options: Model) {
  return options
}

export function defineNotification(options: NotificationOptions) {
  return options
}

export function definePage(options: PagesOption) {
  return options
}

export function definePayment(options: PaymentOptions) {
  return options
}

export function defineSearchEngine(options: SearchEngineOptions) {
  return options
}

export function defineServices(options: ServicesOptions) {
  return options
}

export function defineStorage(options: StorageOptions) {
  return options
}

export function defineUi(options: UiOptions) {
  return options
}
