import type { LogHqLoggingOptions, LogLevel, LogTransport } from '@stacksjs/types'
import { loghqTransport } from '@loghq/stacks'

export interface CreateLogHqTransportOptions extends LogHqLoggingOptions {
  /** Resolved by Stacks' shared integration environment gate. */
  environment: string
}

function logHqLevel(level: LogLevel | undefined): Exclude<LogLevel, 'success'> | undefined {
  return level === 'success' ? 'info' : level
}

/**
 * Build the declarative LogHQ transport used by `config/logging.ts`.
 *
 * No key means no SDK client, timer, queue, or request. Delivery behavior is
 * delegated to `@loghq/stacks`, which buffers on the caller path and contains
 * all network failures without routing diagnostics back through this logger.
 */
export function createLogHqTransport(options: CreateLogHqTransportOptions): LogTransport | null {
  const key = options.key?.trim()
  if (!key)
    return null

  const project = options.project?.trim()
  const level = logHqLevel(options.level)
  const transport = loghqTransport({
    key,
    host: options.baseUrl?.trim() || undefined,
    environment: options.environment,
    minLevel: level,
    enabled: options.enabled,
    batchSize: options.batchSize,
    flushInterval: options.flushInterval,
    maxQueueSize: options.maxQueueSize,
    timeout: options.timeout,
    maxRetries: options.maxRetries,
    beforeSend: project
      ? entry => ({
          ...entry,
          context: { ...entry.context, project },
        })
      : undefined,
  }) as LogTransport

  // The framework filters before the SDK sees a record. Setting both keeps
  // their thresholds aligned and allows LogHQ to be more verbose than console.
  transport.level = options.level

  return transport
}
