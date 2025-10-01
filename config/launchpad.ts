import type { LaunchpadConfig } from '@stacksjs/launchpad'

export const config: LaunchpadConfig = {
  // Object format with version constraints
  dependencies: {
    'bun.com': '^1.2.21',
    'redisio': '^8.0.0',
    'sqlite': '^3.43.0',
  },

  // Or as an array (uses latest versions)
  // dependencies: ['bun.com', 'redisio', 'postgresqlorg'],

  // Or as a string (space-separated, uses latest versions)
  // dependencies: 'bun.com redisio postgresqlorg',

  // Install globally (optional)
  global: false,

  // Enable services to auto-start Redis and SQLite
  services: {
    enabled: true,
    autoStart: true,
    database: {
      connection: 'sqlite',
      name: 'stacks',
      username: 'root',
      password: '',
      authMethod: 'trust',
    },
    postDatabaseSetup: './buddy migrate:fresh --seed',
  },

  verbose: true,
  installPath: '/usr/local',
}

export default config
