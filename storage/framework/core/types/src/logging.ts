/**
 * **Logging Options**
 *
 * This configuration defines all of your logging options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface LoggingOptions {
  /**
   * **Log File Path**
   *
   * The path to the log file. This will be used to write logs to a file. If you do not want to
   * write logs to a file, you may set this to `null`.
   *
   * @default 'storage/logs/console.log'
   */
  logsPath: string

  /**
   * **Deployments Path**
   *
   * The path to the deployments folder. This will be used to write deployment logs to a file.
   * If you do not want to write deployment logs to a file, you may set this to `null`.
   *
   * @default 'storage/logs/deployments.log'
   */
  deploymentsPath: string

  /**
   * **Minimum Log Level**
   *
   * Messages below this level are suppressed. The `LOG_LEVEL` env var
   * overrides this when set (stacksjs/stacks#1935).
   *
   * @default 'info'
   */
  level?: 'debug' | 'info' | 'success' | 'warning' | 'error'

  /**
   * **Output Format**
   *
   * `'json'` for structured output (production), `'text'` for the
   * human-readable dev view. The `LOG_FORMAT` env var overrides this;
   * default is `'json'` in production, `'text'` otherwise.
   *
   * @default 'text'
   */
  format?: 'json' | 'text'

  /**
   * **Write To File**
   *
   * Whether logs are persisted to `logsPath`'s directory as daily
   * files. Set `false` for console-only output (e.g. when the platform
   * captures stdout).
   *
   * @default true
   */
  writeToFile?: boolean
}

export type LoggingConfig = Partial<LoggingOptions>
