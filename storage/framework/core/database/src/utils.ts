/**
 * Database utilities using bun-query-builder
 *
 * This module provides the database connection and query builder
 * configured using the stacks database config.
 */

import { createQueryBuilder } from 'bun-query-builder'

// Try to import setConfig if available (newer versions)
let setConfig: ((config: any) => void) | undefined
try {
  // Dynamic import to handle both old and new versions
  const mod = await import('bun-query-builder')
  if ('setConfig' in mod && typeof mod.setConfig === 'function') {
    setConfig = mod.setConfig
  }
}
catch {
  // setConfig not available in this version
}

// Use default values to avoid circular dependencies initially
// These can be overridden later once config is fully loaded
// Read from environment variables first
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

interface DbConnectionConfig {
  database?: string
  name?: string
  host?: string
  username?: string
  password?: string
  port?: number
  prefix?: string
}

interface DbConfig {
  connections: {
    sqlite: DbConnectionConfig
    mysql: DbConnectionConfig
    postgres: DbConnectionConfig
  }
}

let appEnv: string = envVars.APP_ENV || 'local'
let dbDriver: string = envVars.DB_CONNECTION || 'sqlite'
let dbConfig: DbConfig = {
  connections: {
    sqlite: {
      database: 'database/stacks.sqlite', // SQLite uses file path, not env DB_DATABASE
      prefix: '',
    },
    mysql: {
      name: envVars.DB_DATABASE || 'stacks',
      host: envVars.DB_HOST || '127.0.0.1',
      username: envVars.DB_USERNAME || 'root',
      password: envVars.DB_PASSWORD || '',
      port: Number(envVars.DB_PORT) || 3306,
      prefix: '',
    },
    postgres: {
      name: envVars.DB_DATABASE || 'stacks',
      host: envVars.DB_HOST || '127.0.0.1',
      username: envVars.DB_USERNAME || '',
      password: envVars.DB_PASSWORD || '',
      port: Number(envVars.DB_PORT) || 5432,
      prefix: '',
    },
  },
}

// Function to initialize the config when it's available
export function initializeDbConfig(config: any): void {
  if (config?.app?.env)
    appEnv = config.app.env

  if (config?.database?.default)
    dbDriver = config.database.default

  if (config?.database)
    dbConfig = config.database

  // Update bun-query-builder config
  updateQueryBuilderConfig()
}

// Simple functions with defensive defaults
function getEnv(): string {
  return appEnv
}

function getDriver(): string {
  return dbDriver
}

function getDatabaseConfig(): DbConfig {
  return dbConfig
}

/**
 * Get the dialect type for bun-query-builder
 */
function getDialect(): 'sqlite' | 'mysql' | 'postgres' {
  const driver = getDriver()
  if (driver === 'sqlite') return 'sqlite'
  if (driver === 'mysql') return 'mysql'
  if (driver === 'postgres') return 'postgres'
  return 'sqlite' // default fallback
}

/**
 * Get database configuration for bun-query-builder
 */
function getDbConfig(): { database: string, username?: string, password?: string, host?: string, port?: number } {
  const driver = getDriver()
  const database = getDatabaseConfig()
  const env = getEnv()

  if (driver === 'sqlite') {
    const defaultName = env !== 'testing' ? 'database/stacks.sqlite' : 'database/stacks_testing.sqlite'
    return {
      database: database.connections?.sqlite?.database ?? defaultName,
    }
  }

  if (driver === 'mysql') {
    return {
      database: database.connections?.mysql?.name || 'stacks',
      host: database.connections?.mysql?.host ?? '127.0.0.1',
      username: database.connections?.mysql?.username ?? 'root',
      password: database.connections?.mysql?.password ?? '',
      port: database.connections?.mysql?.port ?? 3306,
    }
  }

  if (driver === 'postgres') {
    const dbName = database.connections?.postgres?.name ?? 'stacks'
    const finalDbName = env === 'testing' ? `${dbName}_testing` : dbName

    return {
      database: finalDbName,
      host: database.connections?.postgres?.host ?? '127.0.0.1',
      username: database.connections?.postgres?.username ?? '',
      password: database.connections?.postgres?.password ?? '',
      port: database.connections?.postgres?.port ?? 5432,
    }
  }

  return { database: ':memory:' }
}

/**
 * Update bun-query-builder configuration
 */
function updateQueryBuilderConfig(): void {
  if (!setConfig) {
    // setConfig not available in this version, config will be passed to createQueryBuilder
    return
  }

  const dialect = getDialect()
  const dbConfigForQb = getDbConfig()

  setConfig({
    dialect,
    database: dbConfigForQb,
    verbose: getEnv() !== 'production',
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
  })
}

// Config is initialized lazily when first accessed via getDb()
// Do NOT call updateQueryBuilderConfig() at module level to avoid circular deps

/**
 * Lazy query builder instance - only created when first accessed.
 * This ensures the database connection is not made at module load time
 * which can cause issues in compiled binaries.
 */
let _dbInstance: ReturnType<typeof createQueryBuilder> | null = null

let _configInitialized = false
let _configInitPromise: Promise<void> | null = null

async function ensureConfigLoaded(): Promise<void> {
  if (_configInitialized) return
  if (_configInitPromise) return _configInitPromise

  _configInitPromise = (async () => {
    try {
      const { config } = await import('@stacksjs/config')
      if (config) {
        initializeDbConfig(config)
      }
    }
    catch {
      // Config not available, use defaults from env vars
    }
    _configInitialized = true
  })()

  return _configInitPromise
}

function getDb(): ReturnType<typeof createQueryBuilder> {
  if (!_dbInstance) {
    // Ensure query builder config is updated before creating instance
    updateQueryBuilderConfig()

    console.log('[database] Creating query builder instance...')
    _dbInstance = createQueryBuilder()
    console.log('[database] Query builder created:', typeof _dbInstance, Object.keys(_dbInstance || {}))
  }
  return _dbInstance
}

// Initialize config asynchronously in the background
ensureConfigLoaded()

/**
 * Lazy proxy for the query builder - connection is only made when first used.
 * This is the main entry point for database operations.
 */
export const db: ReturnType<typeof createQueryBuilder> = new Proxy({} as ReturnType<typeof createQueryBuilder>, {
  get(_target, prop) {
    const instance = getDb()
    const value = (instance as any)[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  },
})

// Export setConfig if available
export { setConfig }
