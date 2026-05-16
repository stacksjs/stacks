import type { MonitoringConfig } from '@stacksjs/types'

/**
 * **Monitoring Configuration**
 *
 * Controls the monitoring feature bundle (Error model + error-tracking
 * views and actions). Flip `enabled` to `false` to leave the bundle inert
 * at boot. Manage via `./buddy monitoring:install` /
 * `./buddy monitoring:uninstall` rather than editing this file by hand.
 */
export default {
  enabled: true,
} satisfies MonitoringConfig
