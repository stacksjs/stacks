import type { CloudConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import security from './security'

/**
 * **Cloud**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  firewall: security.app.firewall,
  storage: {
    private: true,
  }
} satisfies CloudConfig
