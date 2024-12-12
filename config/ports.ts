import type { Ports } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Stacks Ports**
 *
 * This configuration defines all of your Stacks Ports. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  frontend: env.PORT ?? 3000,
  backend: env.PORT_BACKEND ?? 3001,
  admin: env.PORT_ADMIN ?? 3002,
  library: env.PORT_LIBRARY ?? 3003,
  desktop: env.PORT_DESKTOP ?? 3004,
  email: env.PORT_EMAIL ?? 3005,
  docs: env.PORT_DOCS ?? 3006,
  inspect: env.PORT_INSPECT ?? 3007,
  api: env.PORT_API ?? 3008,
  systemTray: env.PORT_SYSTEM_TRAY ?? 3009,
  database: 3010,
} satisfies Ports
