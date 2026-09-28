import type { BugHqMonitoringOptions, ErrorReporter } from '@stacksjs/types'
import { BugHQClient } from '@bughq/sdk'

export interface CreateBugHqReporterOptions extends BugHqMonitoringOptions {
  /** Resolved by Stacks' shared integration environment gate. */
  environment: string
}

/**
 * Create the BugHQ reporter used by `config/monitoring.ts`.
 *
 * Error paths only enqueue through the SDK. Network failures stay inside the
 * client, and the framework drains its in-flight requests through `log.flush()`.
 */
export function createBugHqReporter(options: CreateBugHqReporterOptions): ErrorReporter | null {
  const key = options.key?.trim()
  const dsn = options.dsn?.trim()
  if (!key && !dsn)
    return null

  const client = new BugHQClient({
    key: key || undefined,
    dsn: dsn || undefined,
    host: options.host?.trim() || undefined,
    project: options.project?.trim() || undefined,
    release: options.release?.trim() || undefined,
    environment: options.environment,
    enabled: options.enabled,
    sampleRate: options.sampleRate,
    dedupeMs: options.dedupeMs,
    maxRetries: options.maxRetries,
    framework: 'stacks',
    sdkName: 'bughq.stacks',
    userAgent: '@stacksjs/error-handling (+server; Bun)',
    autoInstrument: false,
    captureUnhandled: false,
    heartbeat: false,
  })

  return {
    name: 'bughq',
    report(event) {
      client.captureException(event.error, event.context)
    },
    async flush() {
      await client.flush(options.flushTimeout)
    },
  }
}
