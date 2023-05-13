import {
  AppOptions,
  CacheOptions,
  CdnOptions,
  CliOptions,
  DatabaseOptions,
  DebugOptions,
  DnsOptions,
  DocsOptions,
  EmailOptions,
  EventOptions,
  GitOptions,
  HashingOptions,
  LibraryOptions,
  NotificationOptions,
  PaymentOptions,
  SearchEngineOptions,
  ServicesOptions,
  StorageOptions,
  UiOptions,
} from "./"

/**.
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
  app: AppOptions

  /**
   * **Cache Options**
   *
   * This configuration defines all of your Cache options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cache: CacheOptions

  /**
   * **CDN Options**
   *
   * This configuration defines all of your CDN options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cdn: CdnOptions

  /**
   * **CLI Options**
   *
   * This configuration defines all of your CLI options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cli: CliOptions

  /**
   * **Database Options**
   *
   * This configuration defines all of your Database options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  database: DatabaseOptions

  /**
   * **Debug Options**
   *
   * This configuration defines all of your Debug options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  debug: DebugOptions

  /**
   * **DNS Options**
   *
   * This configuration defines all of your DNS options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  dns: DnsOptions

  /**
   * **Docs Options**
   *
   * This configuration defines all of your Docs options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  docs: DocsOptions

  /**
   * **Email Options**
   *
   * This configuration defines all of your Email options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  email: EmailOptions

  /**
   * **Event Options**
   *
   * This configuration defines all of your Event options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  event: EventOptions

  /**
   * **Git Options**
   *
   * This configuration defines all of your Git options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  git: GitOptions

  /**
   * **Hashing Options**
   *
   * This configuration defines all of your Hashing options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  hashing: HashingOptions

  /**
   * **Library Options**
   *
   * This configuration defines all of your Library options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  library: LibraryOptions

  /**
   * **Notification Options**
   *
   * This configuration defines all of your Notification options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  notification: NotificationOptions

  /**
   * **Payment Options**
   *
   * This configuration defines all of your Payment options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  payment: PaymentOptions

  /**
   * **Search Engine Options**
   *
   * This configuration defines all of your Search Engine options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  searchEngine: SearchEngineOptions

  /**
   * **Services Options**
   *
   * This configuration defines all of your Services options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  services: ServicesOptions

  /**
   * **Storage Options**
   *
   * This configuration defines all of your Storage options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  storage: StorageOptions

  /**
   * **UI Options**
   *
   * This configuration defines all of your UI options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  ui: UiOptions
}
