/**
 * The severities the framework logs at.
 *
 * Note `success`, which is an outcome rather than a severity: it ranks with
 * `info` when a transport filters by level.
 */
export type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error'

/**
 * Request-scoped fields carried alongside a log line.
 *
 * Populated automatically from the router's trace storage, and extendable by
 * any caller through `withLogContext`.
 */
export interface LogContext {
  requestId?: string
  userId?: string | number
  [key: string]: unknown
}

/**
 * One log call, as a transport sees it.
 *
 * `message` is the formatted line, which is what a transport wants if it is
 * writing text. `args` is the same call before formatting, which is what a
 * transport wants if it is building structured output: an `Error` is still an
 * `Error` there, and a context object is still an object rather than a
 * pretty-printed blob inside a string.
 */
export interface LogRecord {
  level: LogLevel
  /** The formatted, human-readable line. */
  message: string
  /** The arguments exactly as the caller passed them, before formatting. */
  args: unknown[]
  /** Trace id, request id, and anything `withLogContext` added. */
  context?: LogContext
  /** ISO-8601, stamped when the call was made rather than when it is written. */
  timestamp: string
}

/**
 * A destination for log records, alongside the console and the log file.
 *
 * This is the seam for shipping logs somewhere else: a hosted log service, an
 * OpenTelemetry exporter, an in-memory sink in a test. Register one in
 * `config/logging.ts` or at runtime with `registerTransport()`.
 *
 * @example
 * ```ts
 * // config/logging.ts
 * export default {
 *   logsPath: 'storage/logs/console.log',
 *   deploymentsPath: 'storage/logs/deployments.log',
 *   transports: [
 *     {
 *       name: 'memory',
 *       level: 'warning',
 *       log: record => lines.push(record),
 *     },
 *   ],
 * } satisfies LoggingConfig
 * ```
 */
export interface LogTransport {
  /** Identifies the transport in diagnostics. Keep it short and stable. */
  name: string

  /**
   * Drop records less severe than this. Unset means the transport receives
   * everything, including `debug` lines the console is configured to suppress,
   * so a transport can be more verbose than the terminal.
   */
  level?: LogLevel

  /**
   * Handle one record.
   *
   * Deliberately synchronous and expected to return immediately. A transport
   * that needs to do I/O should buffer here and do the work on its own timer,
   * because this runs on the caller's path and a log call must not become the
   * slowest thing in a request. Throwing is caught and does not disturb the
   * logger, but a transport that throws is reported once to stderr.
   */
  log: (record: LogRecord) => void

  /**
   * Drain anything buffered.
   *
   * Called by `log.flush()`, which the framework already runs on `beforeExit`,
   * so a buffering transport gets a chance to deliver before a natural
   * shutdown. Rejections are swallowed: a failed drain must not break an exit
   * path.
   */
  flush?: () => Promise<void>
}

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
  level?: LogLevel

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

  /**
   * **Transports**
   *
   * Additional destinations for every log record, on top of the console and
   * the log file. See {@link LogTransport}.
   *
   * Loaded when the logger first initializes, which is on the first log call.
   * A package that needs to attach earlier, or without the application editing
   * its config, should call `registerTransport()` from `@stacksjs/logging`
   * instead.
   *
   * @default []
   */
  transports?: LogTransport[]
}

export type LoggingConfig = Partial<LoggingOptions>
