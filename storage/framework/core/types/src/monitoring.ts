/**
 * **Monitoring Options**
 *
 * Top-level feature gate for the monitoring bundle (Error model +
 * error-tracking views and actions). Stays inert at boot when `enabled`
 * is `false`.
 */
export interface MonitoringOptions {
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
}

export type MonitoringConfig = Partial<MonitoringOptions>
