import type { LogHqLoggingOptions, LoggingConfig } from '@stacksjs/types'
import { env, initializeIntegration, REMOTE_TELEMETRY_ENVIRONMENTS } from '@stacksjs/env'
import { createLogHqTransport } from '@stacksjs/logging/loghq'
import { storagePath } from '@stacksjs/path'

const loghq = {
  key: env.LOGHQ_KEY,
  baseUrl: env.LOGHQ_BASE_URL || undefined,
  project: env.LOGHQ_PROJECT || env.APP_NAME,
  level: 'info',
  environments: REMOTE_TELEMETRY_ENVIRONMENTS,
} satisfies LogHqLoggingOptions

const loghqInitialization = loghq.key
  ? initializeIntegration(loghq, ({ environment }) => createLogHqTransport({ ...loghq, environment }))
  : null

const remoteTransport = loghqInitialization?.initialized
  ? loghqInitialization.value
  : null

/**
 * **Logging Configuration**
 *
 * This configuration defines all of your logging options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export const loggingConfig = {
  /**
   * **Log File Path**
   *
   * The path to the log file. This will be used to write logs to a file. If you do not want to
   * write logs to a file, you may set this to `null`.
   *
   * @default 'storage/logs/stacks.log'
   */
  logsPath: storagePath('logs/stacks.log'),

  /**
   * **Deployments Path**
   *
   * The path to the deployments folder. This will be used to write deployment logs to a file.
   * If you do not want to write deployment logs to a file, you may set this to `null`.
   *
   * @default 'storage/logs/deployments.log'
   */
  deploymentsPath: storagePath('logs/deployments.log'),

  /**
   * **LogHQ**
   *
   * Set `LOGHQ_KEY` to ship logs from production and staging. Local, test and
   * CI processes do not construct the transport. `LOGHQ_BASE_URL` is only for
   * a self-hosted instance; `LOGHQ_PROJECT` adds a searchable project label.
   */
  loghq,

  /**
   * **Transports**
   *
   * Extra destinations for every log record, on top of the console and the log
   * file. Each one receives the record before formatting, so `args` still holds
   * the real `Error` and the real context object.
   *
   * `log()` must return immediately. A transport doing network I/O should
   * buffer there and deliver on its own timer, then drain in `flush()`, which
   * the framework calls on `beforeExit`.
   *
   * @example
   * transports: [
   *   {
   *     name: 'my-log-service',
   *     level: 'info',
   *     log: record => buffer.push(record),
   *     flush: () => deliver(buffer.splice(0)),
   *   },
   * ],
   *
   * @default []
   */
  transports: remoteTransport ? [remoteTransport] : [],
} satisfies LoggingConfig

export default loggingConfig
