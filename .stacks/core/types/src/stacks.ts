import type {
  AppOptions,
  BinaryOptions,
  CacheOptions,
  CdnOptions,
  DatabaseOptions,
  DnsOptions,
  DocsOptions,
  EmailOptions,
  GitOptions,
  HashingOptions,
  LibraryOptions,
  NotificationOptions,
  PaymentOptions,
  QueueOptions,
  SearchEngineOptions,
  SecurityOptions,
  ServicesOptions,
  StorageOptions,
  UiOptions,
} from './'

/**
 * **Stacks Options**
 *
 * This configuration defines all of your Stacks options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface StacksOptions {
  /**
   * **Application Options**
   *
   * This configuration defines all of your Application options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  app: Partial<AppOptions>

  /**
   * **Binary Options**
   *
   * This configuration defines all of your Binary options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  binary: Partial<BinaryOptions>

  /**
   * **Cache Options**
   *
   * This configuration defines all of your Cache options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cache: Partial<CacheOptions>

  /**
   * **CDN Options**
   *
   * This configuration defines all of your CDN options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cdn: Partial<CdnOptions>

  /**
   * **Database Options**
   *
   * This configuration defines all of your Database options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  database: Partial<DatabaseOptions>

  /**
   * **DNS Options**
   *
   * This configuration defines all of your DNS options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  dns: Partial<DnsOptions>

  /**
   * **Docs Options**
   *
   * This configuration defines all of your Docs options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  docs: Partial<DocsOptions>

  /**
   * **Email Options**
   *
   * This configuration defines all of your Email options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  email: Partial<EmailOptions>

  /**
   * **Git Options**
   *
   * This configuration defines all of your Git options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  git: Partial<GitOptions>

  /**
   * **Hashing Options**
   *
   * This configuration defines all of your Hashing options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  hashing: Partial<HashingOptions>

  /**
   * **Library Options**
   *
   * This configuration defines all of your Library options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  library: Partial<LibraryOptions>

  /**
   * **Notification Options**
   *
   * This configuration defines all of your Notification options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  notification: Partial<NotificationOptions>

  /**
   * **Payment Options**
   *
   * This configuration defines all of your Payment options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  payment: Partial<PaymentOptions>

  /**
   * **Queue Options**
   *
   * This configuration defines all of your Queue options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  queue: Partial<QueueOptions>

  /**
   * **Search Engine Options**
   *
   * This configuration defines all of your Search Engine options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  security: Partial<SecurityOptions>

  /**
   * **Search Engine Options**
   *
   * This configuration defines all of your Search Engine options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  searchEngine: Partial<SearchEngineOptions>

  /**
   * **Services Options**
   *
   * This configuration defines all of your Services options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  services: Partial<ServicesOptions>

  /**
   * **Storage Options**
   *
   * This configuration defines all of your Storage options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  storage: Partial<StorageOptions>

  /**
   * **UI Options**
   *
   * This configuration defines all of your UI options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  ui: Partial<UiOptions>
}

export type StacksConfig = StacksOptions

export type ResolvedStacksOptions = Required<StacksOptions>
