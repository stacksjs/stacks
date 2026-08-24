/**
 * Driver Configuration
 *
 * This module provides configuration helpers and type definitions
 * for database drivers, enabling seamless switching between
 * SQLite, MySQL, and PostgreSQL.
 */

import type { StacksDialect } from '@stacksjs/query-builder'
import type { NetworkedConnectionOptions, PoolOptions, ReadPolicyOptions, ReplicaOptions } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * Connection pool, replica, and read-policy shapes.
 *
 * Defined in `@stacksjs/types` (the package `config/database.ts` is typed
 * against) and aliased here so the database package has one name for them
 * and users never see two subtly different definitions of the same block.
 */
export type PoolConfig = PoolOptions
export type ReplicaConfig = ReplicaOptions
export type ReadPolicyConfig = ReadPolicyOptions
export type NetworkedConnectionConfig = NetworkedConnectionOptions

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
 * MySQL specific configuration.
 *
 * Extends `NetworkedConnectionConfig` for `pool` and `replicas` — both are
 * meaningless for the embedded SQLite dialect, which is why they live on a
 * base the client-server shapes extend rather than on every connection.
 */
export interface MysqlConfig extends NetworkedConnectionConfig {
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
export interface SinglestoreConfig extends NetworkedConnectionConfig {
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
 * Vitess specific configuration.
 *
 * Vitess is a sharding layer in front of MySQL. The application connects to
 * vtgate, which speaks the MySQL wire protocol, so this shares MySQL's
 * connection shape. Two things differ and both matter:
 *
 *  - the default port is vtgate's 15306, not mysqld's 3306. Connecting to
 *    3306 on a Vitess cluster reaches an individual tablet's underlying
 *    MySQL and silently bypasses sharding altogether.
 *  - `name` is a KEYSPACE, not a database. It is the unit Vitess shards,
 *    and it is what the VSchema is written against.
 */
export interface VitessConfig extends NetworkedConnectionConfig {
  /** Keyspace name (Vitess's unit of sharding, dialed like a database). */
  name: string
  /** vtgate host. */
  host?: string
  /** vtgate's MySQL-protocol port. Defaults to 15306. */
  port?: number
  /** Database username */
  username?: string
  /** Database password */
  password?: string
  /** Table prefix */
  prefix?: string
  /** Whether to require TLS — managed Vitess endpoints generally do. */
  ssl?: boolean
  /**
   * Optional target shard/tablet-type qualifier appended to the keyspace,
   * e.g. `@replica` to send this connection's reads to replica tablets.
   * Left unset, vtgate routes to primaries.
   */
  tabletType?: 'primary' | 'replica' | 'rdonly'
  /** Whether this keyspace is split across shards. Defaults to true. */
  sharded?: boolean
}

/**
 * PostgreSQL specific configuration
 */
export interface PostgresConfig extends NetworkedConnectionConfig {
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
  vitess?: VitessConfig
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
  /**
   * How reads are distributed across the active connection's replicas.
   * Cross-cutting rather than per-connection: only one connection is
   * active at a time, and the safety trade-off being made is a property of
   * the application, not of a particular host list.
   */
  reads?: ReadPolicyConfig
}

/**
 * Default configuration values for each driver
 */
export const driverDefaults: Record<StacksDialect, Partial<SqliteConfig | MysqlConfig | SinglestoreConfig | VitessConfig | PostgresConfig | DynamoDbConfig>> = {
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
  // Port 15306 is vtgate's, not mysqld's — see VitessConfig.
  vitess: {
    name: 'stacks',
    host: '127.0.0.1',
    port: 15306,
    username: 'root',
    password: '',
    prefix: '',
    ssl: false,
    sharded: true,
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

    // Vitess is reached through vtgate, which speaks the MySQL wire
    // protocol, so it also dials over `mysql://`. The keyspace takes the
    // database slot, optionally qualified with a tablet type
    // (`keyspace@replica`) to pin this connection to replica tablets.
    case 'vitess': {
      const vtConfig = config as VitessConfig
      const { name, host = '127.0.0.1', port = 15306, username = 'root', password = '', tabletType } = vtConfig
      const keyspace = tabletType ? `${name}@${tabletType}` : name
      return `mysql://${username}:${password}@${host}:${port}/${keyspace}`
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

    case 'vitess': {
      const vtConfig = config as VitessConfig
      if (!vtConfig.name) {
        errors.push('Vitess requires a keyspace name')
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
        ssl: env.DB_SSL === 'true' || env.DB_SSL === '1',
      } as SinglestoreConfig

    case 'vitess':
      return {
        name: env.DB_DATABASE || 'stacks',
        host: env.DB_HOST || '127.0.0.1',
        port: env.DB_PORT ?? 15306,
        username: env.DB_USERNAME || 'root',
        password: env.DB_PASSWORD || '',
        prefix: env.DB_PREFIX || '',
        ssl: env.DB_SSL === 'true' || env.DB_SSL === '1',
        sharded: !['0', 'false', 'no', 'off'].includes(String(env.DB_VITESS_SHARDED ?? 'true').toLowerCase()),
      } as VitessConfig

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
