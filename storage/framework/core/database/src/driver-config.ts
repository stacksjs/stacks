/**
 * Driver Configuration
 *
 * This module provides configuration helpers and type definitions
 * for database drivers, enabling seamless switching between
 * SQLite, MySQL, and PostgreSQL.
 */

import type { StacksDialect } from '@stacksjs/query-builder'
import { env } from '@stacksjs/env'

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
 * SingleStore specific configuration.
 *
 * SingleStore (formerly MemSQL) speaks the MySQL wire protocol, so it shares
 * MySQL's connection shape. It diverges only in DDL (distributed tables with
 * SHARD KEY / SORT KEY, no foreign keys) — handled by the migration generator,
 * not by the connection layer.
 */
export interface SinglestoreConfig {
  /** Database name */
  name: string
  /** Database host (e.g. the SingleStore Helios/managed endpoint) */
  host?: string
  /** Database port (SingleStore listens on 3306, the MySQL port) */
  port?: number
  /** Database username */
  username?: string
  /** Database password */
  password?: string
  /** Table prefix */
  prefix?: string
  /** Character set */
  charset?: string
  /** Whether to require TLS — managed SingleStore (Helios) requires it */
  ssl?: boolean
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
  /** Default table name (for single-table design) */
  tableName?: string
  /** Single-table design configuration */
  singleTable?: {
    /** Enable single-table design */
    enabled?: boolean
    /** Partition key attribute name (default: 'pk') */
    pkAttribute?: string
    /** Sort key attribute name (default: 'sk') */
    skAttribute?: string
    /** Entity type attribute name (default: '_et') */
    entityTypeAttribute?: string
    /** Key delimiter (default: '#') */
    keyDelimiter?: string
    /** Number of GSIs to use (default: 5) */
    gsiCount?: number
  }
}

/**
 * All database connections configuration
 */
export interface DatabaseConnections {
  sqlite?: SqliteConfig
  mysql?: MysqlConfig
  singlestore?: SinglestoreConfig
  postgres?: PostgresConfig
  dynamodb?: DynamoDbConfig
}

/**
 * Full database configuration
 */
export interface FullDatabaseConfig {
  /** Default database driver */
  default: StacksDialect
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
export const driverDefaults: Record<StacksDialect, Partial<SqliteConfig | MysqlConfig | SinglestoreConfig | PostgresConfig | DynamoDbConfig>> = {
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
  singlestore: {
    name: 'stacks',
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: '',
    prefix: '',
    charset: 'utf8mb4',
    ssl: false,
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
  browser: {},
}

/**
 * Get the connection string for a given driver and configuration
 */
export function getConnectionString(driver: StacksDialect, config: DatabaseConnections[keyof DatabaseConnections]): string {
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

    // SingleStore is MySQL wire-compatible, so it dials over `mysql://`.
    case 'singlestore': {
      const ssConfig = config as SinglestoreConfig
      const { name, host = '127.0.0.1', port = 3306, username = 'root', password = '' } = ssConfig
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
export function validateDriverConfig(driver: StacksDialect, config: DatabaseConnections[keyof DatabaseConnections]): { valid: boolean, errors: string[] } {
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

    case 'singlestore': {
      const ssConfig = config as SinglestoreConfig
      if (!ssConfig.name) {
        errors.push('SingleStore requires a database name')
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
export function mergeWithDefaults<T extends keyof DatabaseConnections>(
  driver: T,
  config: Partial<DatabaseConnections[T]>,
): DatabaseConnections[T] {
  const defaults = driverDefaults[driver as StacksDialect]
  return { ...defaults, ...config } as DatabaseConnections[T]
}

/**
 * Get the appropriate configuration for a driver from environment variables
 */
export function getConfigFromEnv(driver: StacksDialect): DatabaseConnections[keyof DatabaseConnections] {

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
        port: env.DB_PORT ?? 3306,
        username: env.DB_USERNAME || 'root',
        password: env.DB_PASSWORD || '',
        prefix: env.DB_PREFIX || '',
      } as MysqlConfig

    case 'singlestore':
      return {
        name: env.DB_DATABASE || 'stacks',
        host: env.DB_HOST || '127.0.0.1',
        port: env.DB_PORT ?? 3306,
        username: env.DB_USERNAME || 'root',
        password: env.DB_PASSWORD || '',
        prefix: env.DB_PREFIX || '',
        ssl: ((env as Record<string, string | undefined>).DB_SSL) === 'true' || ((env as Record<string, string | undefined>).DB_SSL) === '1',
      } as SinglestoreConfig

    case 'postgres':
      return {
        name: env.DB_DATABASE || 'stacks',
        host: env.DB_HOST || '127.0.0.1',
        port: env.DB_PORT ?? 5432,
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
export function detectDriver(): StacksDialect {
  // Check for explicit configuration
  if (env.DB_CONNECTION) {
    return env.DB_CONNECTION as StacksDialect
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
