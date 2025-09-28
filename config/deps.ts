import type { LaunchpadConfig } from '@stacksjs/launchpad'

export const config: LaunchpadConfig = {
  // Object format with version constraints
  dependencies: {
    'bun.com': '^1.2.19',        // Bun runtime
    'redisio': '^8.0.0',         // Redis server
    'postgresqlorg': '^17.0.0',  // PostgreSQL database
  },

  // Or as an array (uses latest versions)
  // dependencies: ['bun.com', 'redisio', 'postgresqlorg'],

  // Or as a string (space-separated, uses latest versions)
  // dependencies: 'bun.com redisio postgresqlorg',

  // Install globally (optional)
  global: false,

  // Enable services to auto-start Redis and PostgreSQL
  services: {
    enabled: true,
    autoStart: true,
    database: {
      username: 'postgres',
      password: 'password',
      authMethod: 'trust',
    },
  },

  verbose: true,
  installPath: '/usr/local',
}

export default config
