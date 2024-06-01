import type { LogLevel } from 'consola'
import { LogLevels, LogTypes } from 'consola'

/**
 * **Logger Options**
 *
 * This configuration defines all of your logger options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface LoggerOptions {
  /**
   * **Log Level**
   *
   * The log level is a number that represents the verbosity of the logs. The higher the number,
   * the more verbose the logs will be. The log levels are as follows:
   *
   * - 0: Error
   * - 1: Warning
   * - 2: Normal
   * - 3: Info
   * - 4: Debug
   * - 5: Trace
   * - -999: Silent
   * - +999: Verbose
   *
   * @default 3
   */
  level: LogLevel

  /**
   * **Log File Path**
   *
   * The path to the log file. This will be used to write logs to a file. If you do not want to
   * write logs to a file, you may set this to `null`.
   *
   * @default 'storage/logs/console.log'
   */
  logFilePath: string

  /**
   * **Errors Log Path**
   *
   * The path to the errors log file. This will be used to write error logs to a file. If you do
   * not want to write error logs to a file, you may set this to `null`.
   *
   * @default 'storage/logs/errors.log'
   */
  errorsPath: string
}

export type LoggerConfig = Partial<LoggerOptions>

export { LogLevels, LogTypes }
