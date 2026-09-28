import type { BugHqMonitoringOptions, MonitoringConfig } from '@stacksjs/types'
import { createBugHqReporter } from '@stacksjs/error-handling/bughq'
import { env, initializeIntegration, REMOTE_TELEMETRY_ENVIRONMENTS } from '@stacksjs/env'

const bughq = {
  key: env.BUGHQ_KEY,
  dsn: env.BUGHQ_DSN,
  host: env.BUGHQ_HOST || undefined,
  project: env.BUGHQ_PROJECT || env.APP_NAME,
  release: env.BUGHQ_RELEASE || undefined,
  environments: REMOTE_TELEMETRY_ENVIRONMENTS,
} satisfies BugHqMonitoringOptions

const bughqInitialization = bughq.key || bughq.dsn
  ? initializeIntegration(bughq, ({ environment }) => createBugHqReporter({ ...bughq, environment }))
  : null

const remoteReporter = bughqInitialization?.initialized
  ? bughqInitialization.value
  : null

/**
 * **Monitoring Configuration**
 *
 * Controls the monitoring feature bundle (Error model + error-tracking
 * views and actions). Flip `enabled` to `false` to leave the bundle inert
 * at boot. Manage via `./buddy monitoring:install` /
 * `./buddy monitoring:uninstall` rather than editing this file by hand.
 * Set `BUGHQ_KEY` or `BUGHQ_DSN` to report production and staging errors.
 * Local, test and CI processes do not construct the reporter.
 */
export default {
  enabled: true,
  bughq,
  reporters: remoteReporter ? [remoteReporter] : [],
} satisfies MonitoringConfig
