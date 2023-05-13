import type { AppOptions, CacheOptions, CdnOptions, CliOptions, CronJobOptions, DatabaseOptions, DebugOptions, DnsOptions, EmailOptions, Events, GitOptions, HashingOptions, LibraryOptions, Model, NotificationOptions, PagesOption, PaymentOptions, SearchEngineOptions, ServicesOptions, StorageOptions, UiOptions } from '@stacksjs/types'

export function env(key: any, fallback?: any) {
  // console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return key
}

export function defineApp(options: Partial<AppOptions>) {
  return options
}

export function defineCache(options: Partial<CacheOptions>) {
  return options
}

export function defineCdn(options: Partial<CdnOptions>) {
  return options
}

export function defineCli(options: Partial<CliOptions>) {
  return options
}

export function defineCronJobsConfig(options: Partial<CronJobOptions>[]) {
  return options
}

export function defineDatabase(options: Partial<DatabaseOptions>) {
  return options
}

export function defineDebugConfig(options: Partial<DebugOptions>) {
  return options
}

// export function defineCloudConfig(options: Partial<CloudOptions>) {
//   return options
// }

export function defineDns(options: Partial<DnsOptions>) {
  return options
}

export function defineEmailConfig(options: Partial<EmailOptions>) {
  return options
}

export function defineEvents(options: Partial<Events>) {
  return options
}

export function defineGit(options: Partial<GitOptions>) {
  return options
}

export function defineHashing(options: Partial<HashingOptions>) {
  return options
}

export function defineLibrary(options: Partial<LibraryOptions>) {
  return options
}

export function defineModel(options: Partial<Model>) {
  return options
}

export function defineNotification(options: Partial<NotificationOptions>) {
  return options
}

export function definePage(options: Partial<PagesOption>) {
  return options
}

export function definePayment(options: Partial<PaymentOptions>) {
  return options
}

export function defineSearchEngine(options: Partial<SearchEngineOptions>) {
  return options
}

export function defineServices(options: Partial<ServicesOptions>) {
  return options
}

export function defineStorage(options: Partial<StorageOptions>) {
  return options
}

export function defineUi(options: Partial<UiOptions>) {
  return options
}
