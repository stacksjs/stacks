import type { BugHqMonitoringOptions, MonitoringConfig } from '@stacksjs/types'
import { createDatabaseErrorReporter } from '@stacksjs/database/error-reporter'
import { createBugHqReporter } from '@stacksjs/error-handling/bughq'
import { env, initializeIntegration, REMOTE_TELEMETRY_ENVIRONMENTS } from '@stacksjs/env'
import services from './services'

const bughq = {
  // The key, the origin and the project id live in config/services.ts, with every
  // other HQ service.
  key: services.bughq.key,
  dsn: env.BUGHQ_DSN,
  host: services.bughq.url,
  // BugHQ looks this up as a project id and answers "unknown project" for
  // anything else, so there is no default: a key alone identifies the project.
  project: env.BUGHQ_PROJECT || services.bughq.project,
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
  reporters: [createDatabaseErrorReporter(), ...(remoteReporter ? [remoteReporter] : [])],
} satisfies MonitoringConfig
