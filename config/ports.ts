import type { Ports } from '@stacksjs/types'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

/**
 * **Stacks Ports**
 *
 * This configuration defines all of your Stacks Ports. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  frontend: envVars.PORT ?? 3000,
  backend: envVars.PORT_BACKEND ?? 3001,
  admin: envVars.PORT_ADMIN ?? 3002,
  library: envVars.PORT_LIBRARY ?? 3003,
  desktop: envVars.PORT_DESKTOP ?? 3004,
  email: envVars.PORT_EMAIL ?? 3005,
  docs: envVars.PORT_DOCS ?? 3006,
  inspect: envVars.PORT_INSPECT ?? 3007,
  api: envVars.PORT_API ?? 3008,
  systemTray: envVars.PORT_SYSTEM_TRAY ?? 3009,
  database: 3010,
} satisfies Ports
