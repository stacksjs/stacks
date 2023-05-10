import type { AppOptions, CacheOptions, CdnOptions, CliOptions, CronJobOptions, DatabaseOptions, DebugOptions, DnsOptions, DocsOptions, EmailOptions, Events, GitOptions, HashingOptions, LibraryOptions, NotificationOptions, PagesOption, PaymentOptions, SearchEngineOptions, ServicesOptions, StorageOptions, UiOptions } from '@stacksjs/types'

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
  cronJobs?: Partial<CronJobOptions>
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
  docs?: DocsOptions
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
  // model?: Partial<Model>
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

// export type ResolvedStacksOptions = Required<Omit<StacksOptions, 'model'>>
export type ResolvedStacksOptions = Required<StacksOptions>

export { defineBuildConfig } from 'unbuild'
