/**
 * Driver Configuration
 *
 * This module provides configuration helpers and type definitions
 * for database drivers, enabling seamless switching between
 * SQLite, MySQL, and PostgreSQL.
 */

import type { SupportedDialect } from 'bun-query-builder'

/**
 * SQLite specific configuration
 */
export interface SqliteConfig {
  /** Path to the SQLite database file */
  database: string
  /** Table prefix */
  prefix?: string
}

/**
 * MySQL specific configuration
 */
export interface MysqlConfig {
  /** Database name */
  name: string
  /** Database host */
  host?: string
  /** Database port */
  port?: number
  /** Database username */
  username?: string
  /** Database password */
  password?: string
  /** Table prefix */
  prefix?: string
  /** Character set */
  charset?: string
  /** Collation */
  collation?: string
}

/**
 * PostgreSQL specific configuration
 */
export interface PostgresConfig {
  /** Database name */
  name: string
  /** Database host */
  host?: string
  /** Database port */
  port?: number
  /** Database username */
  username?: string
  /** Database password */
  password?: string
  /** Table prefix */
  prefix?: string
  /** Schema name */
  schema?: string
  /** SSL mode */
  sslMode?: 'disable' | 'require' | 'verify-ca' | 'verify-full'
}

/**
 * DynamoDB specific configuration
 */
export interface DynamoDbConfig {
  /** AWS access key ID */
  key: string
  /** AWS secret access key */
  secret: string
  /** AWS region */
  region?: string
  /** Table prefix */
  prefix?: string
  /** DynamoDB endpoint (for local development) */
  endpoint?: string
}

/**
 * All database connections configuration
 */
export interface DatabaseConnections {
  sqlite?: SqliteConfig
  mysql?: MysqlConfig
  postgres?: PostgresConfig
  dynamodb?: DynamoDbConfig
}

/**
 * Full database configuration
 */
export interface FullDatabaseConfig {
  /** Default database driver */
  default: SupportedDialect
  /** Connection configurations */
  connections: DatabaseConnections
  /** Migrations table name */
  migrations?: string
  /** Migration locks table name */
  migrationLocks?: string
}

/**
 * Default configuration values for each driver
 */
export const driverDefaults: Record<SupportedDialect, Partial<DatabaseConnections[keyof DatabaseConnections]>> = {
  sqlite: {
    database: 'database/stacks.sqlite',
    prefix: '',
  },
  mysql: {
    name: 'stacks',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: '',
    prefix: '',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  },
  postgres: {
    name: 'stacks',
    host: '127.0.0.1',
    port: 5432,
    username: 'postgres',
    password: '',
    prefix: '',
    schema: 'public',
  },
}

/**
 * Get the connection string for a given driver and configuration
 */
export function getConnectionString(driver: SupportedDialect, config: DatabaseConnections[keyof DatabaseConnections]): string {
  switch (driver) {
    case 'sqlite': {
      const sqliteConfig = config as SqliteConfig
      if (sqliteConfig.database === ':memory:') {
        return ':memory:'
      }
      return `sqlite://${sqliteConfig.database}`
    }

    case 'mysql': {
      const mysqlConfig = config as MysqlConfig
      const { name, host = '127.0.0.1', port = 3306, username = 'root', password = '' } = mysqlConfig
      return `mysql://${username}:${password}@${host}:${port}/${name}`
    }

    case 'postgres': {
      const pgConfig = config as PostgresConfig
      const { name, host = '127.0.0.1', port = 5432, username = 'postgres', password = '' } = pgConfig
      return `postgres://${username}:${password}@${host}:${port}/${name}`
    }

    default:
      throw new Error(`Unsupported driver: ${driver}`)
  }
}

/**
 * Validate driver configuration
 */
export function validateDriverConfig(driver: SupportedDialect, config: DatabaseConnections[keyof DatabaseConnections]): { valid: boolean, errors: string[] } {
  const errors: string[] = []

  switch (driver) {
    case 'sqlite': {
      const sqliteConfig = config as SqliteConfig
      if (!sqliteConfig.database) {
        errors.push('SQLite requires a database path')
      }
      break
    }

    case 'mysql': {
      const mysqlConfig = config as MysqlConfig
      if (!mysqlConfig.name) {
        errors.push('MySQL requires a database name')
      }
      break
    }

    case 'postgres': {
      const pgConfig = config as PostgresConfig
      if (!pgConfig.name) {
        errors.push('PostgreSQL requires a database name')
      }
      break
    }

    default:
      errors.push(`Unsupported driver: ${driver}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Merge user configuration with defaults
 */
export function mergeWithDefaults<T extends SupportedDialect>(
  driver: T,
  config: Partial<DatabaseConnections[T]>,
): DatabaseConnections[T] {
  const defaults = driverDefaults[driver]
  return { ...defaults, ...config } as DatabaseConnections[T]
}

/**
 * Get the appropriate configuration for a driver from environment variables
 */
export function getConfigFromEnv(driver: SupportedDialect): DatabaseConnections[keyof DatabaseConnections] {
  const env = typeof Bun !== 'undefined' ? Bun.env : process.env

  switch (driver) {
    case 'sqlite':
      return {
        database: env.DB_DATABASE || 'database/stacks.sqlite',
        prefix: env.DB_PREFIX || '',
      } as SqliteConfig

    case 'mysql':
      return {
        name: env.DB_DATABASE || 'stacks',
        host: env.DB_HOST || '127.0.0.1',
        port: Number(env.DB_PORT) || 3306,
        username: env.DB_USERNAME || 'root',
        password: env.DB_PASSWORD || '',
        prefix: env.DB_PREFIX || '',
      } as MysqlConfig

    case 'postgres':
      return {
        name: env.DB_DATABASE || 'stacks',
        host: env.DB_HOST || '127.0.0.1',
        port: Number(env.DB_PORT) || 5432,
        username: env.DB_USERNAME || 'postgres',
        password: env.DB_PASSWORD || '',
        prefix: env.DB_PREFIX || '',
        schema: env.DB_SCHEMA || 'public',
      } as PostgresConfig

    default:
      throw new Error(`Unsupported driver: ${driver}`)
  }
}

/**
 * Detect the best available driver based on environment
 */
export function detectDriver(): SupportedDialect {
  const env = typeof Bun !== 'undefined' ? Bun.env : process.env

  // Check for explicit configuration
  if (env.DB_CONNECTION) {
    return env.DB_CONNECTION as SupportedDialect
  }

  // Check for PostgreSQL connection info
  if (env.DATABASE_URL?.startsWith('postgres')) {
    return 'postgres'
  }

  // Check for MySQL connection info
  if (env.DATABASE_URL?.startsWith('mysql')) {
    return 'mysql'
  }

  // Default to SQLite
  return 'sqlite'
}
