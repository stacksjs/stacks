import type {
  AppOptions,
  CacheOptions,
  CdnOptions,
  JobOptions as CronJobOptions,
  DatabaseOptions,
  DependenciesOptions,
  DnsOptions,
  EmailOptions,
  Events,
  GitOptions,
  HashingOptions,
  JobOptions,
  LibraryOptions,
  Model,
  NotificationOptions,
  PagesOption,
  PaymentOptions,
  QueueOptions,
  SearchEngineOptions,
  ServicesOptions,
  StorageOptions,
  UiOptions,
  UserCliOptions,
} from '@stacksjs/types'

export { loadStacksConfig as config } from '@stacksjs/config'

export function defineApp(config: Partial<AppOptions>) {
  return config
}

export function defineCache(config: Partial<CacheOptions>) {
  return config
}

export function defineCdn(config: Partial<CdnOptions>) {
  return config
}

export function defineCli(config: Partial<UserCliOptions>) {
  return config
}

export function defineCronJobsConfig(config: Partial<CronJobOptions>[]) {
  return config
}

export function defineJobsConfig(config: Partial<JobOptions>[]) {
  return config
}

export function defineDeps(config: Partial<DependenciesOptions>) {
  return config
}

export function defineDependencies(config: Partial<DependenciesOptions>) {
  return config
}

export function defineDatabase(config: Partial<DatabaseOptions>) {
  return config
}

// export function defineCloudConfig(config: Partial<CloudOptions>) {
//   return config
// }

export function defineDns(config: Partial<DnsOptions>) {
  return config
}

export function defineEmailConfig(config: Partial<EmailOptions>) {
  return config
}

export function defineEvents(config: Partial<Events>) {
  return config
}

export function defineGit(config: Partial<GitOptions>) {
  return config
}

export function defineHashing(config: Partial<HashingOptions>) {
  return config
}

export function defineLibrary(config: Partial<LibraryOptions>) {
  return config
}

export function defineModel(config: Partial<Model>) {
  return config
}

export function defineNotification(config: Partial<NotificationOptions>) {
  return config
}

export function defineSms(config: Partial<NotificationOptions['sms']>) {
  return config
}

export function defineEmail(config: Partial<NotificationOptions['email']>) {
  return config
}

export function defineChat(config: Partial<NotificationOptions['chat']>) {
  return config
}

export function definePage(config: Partial<PagesOption>) {
  return config
}

export function definePayment(config: Partial<PaymentOptions>) {
  return config
}

export function defineQueue(config: Partial<QueueOptions>) {
  return config
}

export function defineSearchEngine(config: Partial<SearchEngineOptions>) {
  return config
}

export function defineServices(config: Partial<ServicesOptions>) {
  return config
}

export function defineStorage(config: Partial<StorageOptions>) {
  return config
}

export function defineUi(config: Partial<UiOptions>) {
  return config
}
