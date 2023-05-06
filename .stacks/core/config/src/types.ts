import type { AppOptions, CacheOptions, CdnOptions, CliOptions, CronJobOptions, DatabaseOptions, DebugOptions, DnsOptions, DocsOptions, EmailOptions, Events, GitOptions, HashingOptions, LibraryOptions, Model, NotificationOptions, PagesOption, PaymentOptions, SearchEngineOptions, ServicesOptions, StorageOptions, UiOptions } from '@stacksjs/types'

export interface StacksOptions {
  /**
   * The Application config.
   */
  app?: Partial<AppOptions>
  /**
   * The Cache config.
   */
  cache?: Partial<CacheOptions>
  /**
   * The CDN config.
   */
  cdn?: Partial<CdnOptions>
  /**
   * The CLI config.
   */
  cli?: Partial<CliOptions>
  /**
   * The Cron Jobs config.
   */
  cronJobs?: Partial<CronJobOptions>[]
  /**
   * The Database config.
   */
  database?: Partial<DatabaseOptions>
  /**
   * The Debug config.
   */
  debug?: Partial<DebugOptions>
  // cloud?: Partial<CloudOptions>
  /**
   * The Docs config.
   */
  docs?: Partial<DocsOptions>
  /**
   * The DNS config.
   */
  dns?: Partial<DnsOptions>
  /**
   * The Email config.
   */
  email?: Partial<EmailOptions>
  /**
   * The Events config.
   */
  events?: Partial<Events>
  /**
   * The Git config.
   */
  git?: Partial<GitOptions>
  /**
   * The Hashing config.
   */
  hashing?: Partial<HashingOptions>
  /**
   * The Library config.
   */
  library?: Partial<LibraryOptions>
  /**
   * The Model config.
   */
  model?: Partial<Model>
  /**
   * The Notification config.
   */
  notification?: Partial<NotificationOptions>
  /**
   * The Pages config.
   */
  pages?: Partial<PagesOption>
  /**
   * The Payment config.
   */
  payment?: Partial<PaymentOptions>
  /**
   *  The Search Engine config.
   */
  searchEngine?: Partial<SearchEngineOptions>
  /**
   * The Services config.
   */
  services?: Partial<ServicesOptions>
  /**
   * The Storage config.
   */
  storage?: Partial<StorageOptions>
  /**
   * The UI config.
   */
  ui?: Partial<UiOptions>
}

export type ResolvedStacksOptions = Required<StacksOptions>

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

export { defineBuildConfig } from 'unbuild'
