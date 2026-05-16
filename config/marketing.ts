import type { MarketingConfig } from '@stacksjs/types'

/**
 * **Marketing Configuration**
 *
 * Controls the marketing feature bundle (`/api/email/subscribe`,
 * `/api/contact`, Campaign / EmailList / SocialPost). Flip `enabled` to
 * `false` to leave the bundle inert at boot. Manage via
 * `./buddy marketing:install` / `./buddy marketing:uninstall` rather than
 * editing this file by hand.
 */
export default {
  enabled: true,
} satisfies MarketingConfig
