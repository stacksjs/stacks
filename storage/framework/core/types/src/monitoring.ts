/**
 * **Monitoring Options**
 *
 * Top-level feature gate for the monitoring bundle (Error model +
 * error-tracking views and actions). Stays inert at boot when `enabled`
 * is `false`.
 */
export interface ErrorReportContext {
  requestId?: string
  url?: string
  method?: string
  userId?: string | number
  ip?: string
  userAgent?: string
  status?: number
  label?: string
  [key: string]: unknown
}

export interface ErrorReport {
  error: Error
  context?: ErrorReportContext
}

/**
 * A synchronous error-reporting destination.
 *
 * Network reporters buffer in `report()` and drain in `flush()`, so an error
 * path never waits on another service or trades the original failure for a
 * reporting failure.
 */
export interface ErrorReporter {
  name: string
  report: (event: ErrorReport) => void
  flush?: () => Promise<void>
}

/** BugHQ delivery configured through `config/monitoring.ts`. */
export interface BugHqMonitoringOptions {
  /** Public project ingest key. An empty key and empty DSN disable reporting. */
  key?: string
  /** DSN containing the host, key and project. */
  dsn?: string
  /** Ingest origin for a self-hosted BugHQ instance. */
  host?: string
  /** Project id when it is not encoded in a DSN. */
  project?: string
  /** Release identifier attached to every error. */
  release?: string
  /** Master switch. The environment allowlist still applies when true. */
  enabled?: boolean
  /** Environment labels permitted to transmit. */
  environments?: readonly string[]
  /** Fraction of errors delivered, from zero to one. */
  sampleRate?: number
  /** Window in milliseconds for suppressing identical errors. */
  dedupeMs?: number
  /** Delivery retries after the initial request. */
  maxRetries?: number
  /** Maximum time `flush()` waits for in-flight requests. */
  flushTimeout?: number
}

export interface MonitoringOptions {
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
  /** Built-in remote error reporter. */
  bughq?: BugHqMonitoringOptions
  /** Additional destinations for handled and unhandled exceptions. */
  reporters?: ErrorReporter[]
}

export type MonitoringConfig = Partial<MonitoringOptions>
