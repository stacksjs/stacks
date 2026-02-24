/**
 * Database Defaults & Constants
 *
 * Centralizes all hardcoded default values for database connections
 * so they are defined once and easily discoverable.
 */

// ============================================================================
// HOST / PORT DEFAULTS
// ============================================================================

export const DB_HOST_DEFAULT = '127.0.0.1'

export const DB_PORTS = {
  mysql: 3306,
  postgres: 5432,
  sqlite: 0,
} as const

export const DB_NAMES = {
  default: 'stacks',
  sqlitePath: 'database/stacks.sqlite',
  sqliteTestingPath: 'database/stacks_testing.sqlite',
} as const

export const DB_USERS = {
  mysql: 'root',
  postgres: 'postgres',
  sqlite: '',
} as const

export const REDIS_DEFAULTS = {
  host: 'localhost',
  port: 6379,
} as const

export const AWS_DEFAULTS = {
  region: 'us-east-1',
} as const

// ============================================================================
// CONNECTION CONFIG BUILDERS
// ============================================================================

export interface ConnectionDefaults {
  database: string
  host?: string
  port?: number
  username?: string
  password?: string
  prefix?: string
}

/**
 * Get default connection config for a given database driver.
 * Reads from the typed env proxy so values are auto-coerced.
 */
export function getConnectionDefaults(driver: string, envProxy?: Record<string, any>): ConnectionDefaults {
  // If an env proxy is provided, use it; otherwise use bare defaults
  const e = envProxy ?? {}

  switch (driver) {
    case 'sqlite':
      return {
        database: e.DB_DATABASE_PATH || DB_NAMES.sqlitePath,
        prefix: '',
      }

    case 'mysql':
      return {
        database: e.DB_DATABASE || DB_NAMES.default,
        host: e.DB_HOST || DB_HOST_DEFAULT,
        port: e.DB_PORT || DB_PORTS.mysql,
        username: e.DB_USERNAME || DB_USERS.mysql,
        password: e.DB_PASSWORD || '',
        prefix: '',
      }

    case 'postgres':
      return {
        database: e.DB_DATABASE || DB_NAMES.default,
        host: e.DB_HOST || DB_HOST_DEFAULT,
        port: e.DB_PORT || DB_PORTS.postgres,
        username: e.DB_USERNAME || DB_USERS.postgres,
        password: e.DB_PASSWORD || '',
        prefix: '',
      }

    default:
      return { database: ':memory:' }
  }
}
