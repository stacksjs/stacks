/**
 * Database - Main database initialization and management class
 *
 * This class provides a clean interface for initializing and managing
 * database connections using bun-query-builder. It supports seamless
 * driver switching between SQLite, MySQL, and PostgreSQL.
 */

import type { QueryBuilder, QueryBuilderConfig, SupportedDialect } from 'bun-query-builder'
import { createQueryBuilder, setConfig } from 'bun-query-builder'

export interface DatabaseConnectionConfig {
  /** Database name or file path (for SQLite) */
  database: string
  /** Database host (not used for SQLite) */
  host?: string
  /** Database port */
  port?: number
  /** Database username */
  username?: string
  /** Database password */
  password?: string
  /** Full connection URL (overrides other options) */
  url?: string
}

export interface DatabaseOptions {
  /** The database driver to use */
  driver: SupportedDialect
  /** Connection configuration */
  connection: DatabaseConnectionConfig
  /** Enable verbose logging */
  verbose?: boolean
  /** Timestamp column configuration */
  timestamps?: {
    createdAt?: string
    updatedAt?: string
    defaultOrderColumn?: string
  }
  /** Soft delete configuration */
  softDeletes?: {
    enabled?: boolean
    column?: string
    defaultFilter?: boolean
  }
  /** Model hooks */
  hooks?: QueryBuilderConfig['hooks']
}

/**
 * Database class for managing database connections
 *
 * @example
 * ```ts
 * // Initialize with SQLite
 * const db = new Database({
 *   driver: 'sqlite',
 *   connection: { database: 'database/app.sqlite' }
 * })
 *
 * // Initialize with PostgreSQL
 * const db = new Database({
 *   driver: 'postgres',
 *   connection: {
 *     database: 'myapp',
 *     host: 'localhost',
 *     port: 5432,
 *     username: 'postgres',
 *     password: 'secret'
 *   }
 * })
 *
 * // Use the query builder
 * const users = await db.query.selectFrom('users').where('active', '=', true).get()
 * ```
 */
export class Database {
  private _queryBuilder: QueryBuilder | null = null
  private _options: DatabaseOptions
  private _initialized = false

  constructor(options: DatabaseOptions) {
    this._options = {
      verbose: false,
      timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        defaultOrderColumn: 'created_at',
      },
      softDeletes: {
        enabled: false,
        column: 'deleted_at',
        defaultFilter: true,
      },
      ...options,
    }
  }

  /**
   * Get the current database driver
   */
  get driver(): SupportedDialect {
    return this._options.driver
  }

  /**
   * Get the connection configuration
   */
  get connection(): DatabaseConnectionConfig {
    return this._options.connection
  }

  /**
   * Check if the database is initialized
   */
  get isInitialized(): boolean {
    return this._initialized
  }

  /**
   * Get the query builder instance
   * Lazily initializes the connection on first access
   */
  get query(): QueryBuilder {
    if (!this._queryBuilder) {
      this.initialize()
    }
    return this._queryBuilder!
  }

  /**
   * Initialize the database connection
   * Called automatically on first query access
   */
  initialize(): void {
    if (this._initialized) return

    // Configure bun-query-builder
    setConfig({
      dialect: this._options.driver,
      database: this._options.connection,
      verbose: this._options.verbose,
      timestamps: this._options.timestamps,
      softDeletes: this._options.softDeletes,
      hooks: this._options.hooks,
    })

    // Create the query builder instance
    this._queryBuilder = createQueryBuilder()
    this._initialized = true
  }

  /**
   * Switch to a different database driver
   * This will close the current connection and create a new one
   */
  switchDriver(driver: SupportedDialect, connection: DatabaseConnectionConfig): void {
    // Close existing connection if any
    this.close()

    // Update options
    this._options.driver = driver
    this._options.connection = connection
    this._initialized = false

    // Reinitialize
    this.initialize()
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this._queryBuilder && typeof (this._queryBuilder as any).close === 'function') {
      (this._queryBuilder as any).close()
    }
    this._queryBuilder = null
    this._initialized = false
  }

  /**
   * Create a new Database instance from Stacks config
   */
  static fromConfig(config: {
    default: SupportedDialect
    connections: {
      sqlite?: { database: string }
      mysql?: { name: string, host?: string, port?: number, username?: string, password?: string }
      postgres?: { name: string, host?: string, port?: number, username?: string, password?: string }
    }
  }, env?: string): Database {
    const driver = config.default
    let connection: DatabaseConnectionConfig

    switch (driver) {
      case 'sqlite': {
        const dbPath = env === 'testing'
          ? config.connections.sqlite?.database?.replace('.sqlite', '_testing.sqlite') || 'database/stacks_testing.sqlite'
          : config.connections.sqlite?.database || 'database/stacks.sqlite'
        connection = { database: dbPath }
        break
      }

      case 'mysql': {
        const mysql = config.connections.mysql
        connection = {
          database: mysql?.name || 'stacks',
          host: mysql?.host || '127.0.0.1',
          port: mysql?.port || 3306,
          username: mysql?.username || 'root',
          password: mysql?.password || '',
        }
        break
      }

      case 'postgres': {
        const postgres = config.connections.postgres
        const dbName = postgres?.name || 'stacks'
        connection = {
          database: env === 'testing' ? `${dbName}_testing` : dbName,
          host: postgres?.host || '127.0.0.1',
          port: postgres?.port || 5432,
          username: postgres?.username || '',
          password: postgres?.password || '',
        }
        break
      }

      default:
        connection = { database: ':memory:' }
    }

    return new Database({
      driver,
      connection,
      verbose: env !== 'production',
    })
  }

  /**
   * Create a new Database instance from environment variables
   */
  static fromEnv(): Database {
    const env = typeof Bun !== 'undefined' ? Bun.env : process.env
    const driver = (env.DB_CONNECTION as SupportedDialect) || 'sqlite'

    let connection: DatabaseConnectionConfig

    switch (driver) {
      case 'sqlite':
        connection = {
          database: env.DB_DATABASE || 'database/stacks.sqlite',
        }
        break

      case 'mysql':
        connection = {
          database: env.DB_DATABASE || 'stacks',
          host: env.DB_HOST || '127.0.0.1',
          port: Number(env.DB_PORT) || 3306,
          username: env.DB_USERNAME || 'root',
          password: env.DB_PASSWORD || '',
        }
        break

      case 'postgres':
        connection = {
          database: env.DB_DATABASE || 'stacks',
          host: env.DB_HOST || '127.0.0.1',
          port: Number(env.DB_PORT) || 5432,
          username: env.DB_USERNAME || '',
          password: env.DB_PASSWORD || '',
        }
        break

      default:
        connection = { database: ':memory:' }
    }

    return new Database({
      driver,
      connection,
      verbose: env.APP_ENV !== 'production',
    })
  }
}

/**
 * Create a database connection with the given options
 */
export function createDatabase(options: DatabaseOptions): Database {
  return new Database(options)
}

/**
 * Create a SQLite database connection
 */
export function createSqliteDatabase(database: string, options?: Partial<Omit<DatabaseOptions, 'driver' | 'connection'>>): Database {
  return new Database({
    driver: 'sqlite',
    connection: { database },
    ...options,
  })
}

/**
 * Create a PostgreSQL database connection
 */
export function createPostgresDatabase(connection: DatabaseConnectionConfig, options?: Partial<Omit<DatabaseOptions, 'driver' | 'connection'>>): Database {
  return new Database({
    driver: 'postgres',
    connection,
    ...options,
  })
}

/**
 * Create a MySQL database connection
 */
export function createMysqlDatabase(connection: DatabaseConnectionConfig, options?: Partial<Omit<DatabaseOptions, 'driver' | 'connection'>>): Database {
  return new Database({
    driver: 'mysql',
    connection,
    ...options,
  })
}
