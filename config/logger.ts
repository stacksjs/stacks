import { path as p } from '@stacksjs/path'
import type { LoggerConfig } from '@stacksjs/types'

/**
 * **Logger Configuration**
 *
 * This configuration defines all of your logger options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  /**
   * **Log File Path**
   *
   * The path to the log file. This will be used to write logs to a file. If you do not want to
   * write logs to a file, you may set this to `null`.
   *
   * @default 'storage/logs/stacks.log'
   */
  logsPath: p.storagePath('logs/stacks.log'),
} satisfies LoggerConfig
