import type {
  AiConfig,
  AnalyticsConfig,
  AppConfig,
  BinaryConfig,
  CacheConfig,
  CloudConfig,
  DatabaseConfig,
  DnsConfig,
  DocsConfig,
  EmailConfig,
  GitConfig,
  HashingConfig,
  LibraryConfig,
  LoggerConfig,
  NotificationConfig,
  PaymentConfig,
  QueueConfig,
  SearchEngineConfig,
  SecurityConfig,
  ServicesConfig,
  StorageConfig,
  Team,
  UiConfig,
  Ports,
} from '.'

/**
 * **Stacks Options**
 *
 * This configuration defines all of your Stacks options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface StacksOptions {
  ai: AiConfig

  /**
   * **Analytics Options**
   *
   * This configuration defines all of your Analytics options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  analytics: AnalyticsConfig

  /**
   * **Application Options**
   *
   * This configuration defines all of your Application options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  app: AppConfig

  /**
   * **Cache Options**
   *
   * This configuration defines all of your Cache options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cache: CacheConfig

  /**
   * **CLI / Binary Options**
   *
   * This configuration defines all of your Binary options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cli: BinaryConfig

  /**
   * **Cloud Options**
   *
   * This configuration defines all of your Cloud options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  cloud: CloudConfig

  /**
   * **Database Options**
   *
   * This configuration defines all of your Database options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  database: DatabaseConfig

  /**
   * **DNS Options**
   *
   * This configuration defines all of your DNS options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  dns: DnsConfig

  /**
   * **Docs Options**
   *
   * This configuration defines all of your Docs options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  docs: DocsConfig

  /**
   * **Email Options**
   *
   * This configuration defines all of your Email options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  email: EmailConfig

  /**
   * **Git Options**
   *
   * This configuration defines all of your Git options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  git: GitConfig

  /**
   * **Hashing Options**
   *
   * This configuration defines all of your Hashing options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  hashing: HashingConfig

  /**
   * **Library Options**
   *
   * This configuration defines all of your Library options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  library: LibraryConfig

  /**
   * **Logger Options**
   *
   * This configuration defines all of your Logger options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  logger: LoggerConfig

  /**
   * **Notification Options**
   *
   * This configuration defines all of your Notification options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  notification: NotificationConfig

  /**
   * **Payment Options**
   *
   * This configuration defines all of your Payment options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  payment: PaymentConfig

  /**
   * **Ports**
   *
   * This configuration defines all of your Ports options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  ports: Ports

  /**
   * **Queue Options**
   *
   * This configuration defines all of your Queue options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  queue: QueueConfig

  /**
   * **Search Engine Options**
   *
   * This configuration defines all of your Search Engine options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  security: SecurityConfig

  /**
   * **Search Engine Options**
   *
   * This configuration defines all of your Search Engine options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  searchEngine: SearchEngineConfig

  /**
   * **Services Options**
   *
   * This configuration defines all of your Services options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  services: ServicesConfig

  /**
   * **Storage Options**
   *
   * This configuration defines all of your Storage options. Because Stacks is fully-typed,
   * you may hover any of the options below and the definitions will be provided. In case
   * you have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  storage: StorageConfig

  /**
   * **Team Members**
   *
   * This configuration defines all of your Team members. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  team: Team

  /**
   * **UI Options**
   *
   * This configuration defines all of your UI options. Because Stacks is fully-typed, you
   * may hover any of the options below and the definitions will be provided. In case you
   * have any questions, feel free to reach out via Discord or GitHub Discussions.
   */
  ui: UiConfig
}

export type StacksConfig = Partial<StacksOptions>
