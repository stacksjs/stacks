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

export interface MonitoringOptions {
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
  /** Additional destinations for handled and unhandled exceptions. */
  reporters?: ErrorReporter[]
}

export type MonitoringConfig = Partial<MonitoringOptions>
