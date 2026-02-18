import type { Result } from '@stacksjs/error-handling'
import type { MigrationResult } from '../migrations'
import { err, ok } from '@stacksjs/error-handling'
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import Database from 'bun:sqlite'

// Use environment variables directly to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

function getDriver(): string {
  return envVars.DB_CONNECTION || 'sqlite'
}

function getMigrationsPath(): string {
  return join(process.cwd(), 'database', 'migrations')
}

function hasJobsMigrationBeenCreated(): boolean {
  try {
    const migrationsPath = getMigrationsPath()
    if (!existsSync(migrationsPath)) {
      return false
    }
    const files = readdirSync(migrationsPath)
    return files.some(file => file.includes('create-jobs-table'))
  }
  catch {
    return false
  }
}

function getDatabasePath(): string {
  // Try APP_ROOT first (set by stacks), then fall back to cwd
  const appRoot = envVars.APP_ROOT || process.cwd()
  return join(appRoot, 'database', 'stacks.sqlite')
}

async function jobsTableExists(): Promise<boolean> {
  const driver = getDriver()

  // Always check SQLite if the database file exists (common dev setup)
  const sqlitePath = getDatabasePath()
  if (existsSync(sqlitePath)) {
    try {
      const sqlite = new Database(sqlitePath)
      const result = sqlite.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'`).get()
      sqlite.close()
      return result !== null
    }
    catch {
      // Fall through to other drivers
    }
  }

  // If not using SQLite or SQLite check failed, try the configured driver
  if (driver !== 'sqlite') {
    try {
      const { db } = await import('../utils')
      await (db as any).selectFrom('jobs').select('id').limit(1).execute()
      return true
    }
    catch {
      return false
    }
  }

  return false
}

export async function createJobsMigration(): Promise<Result<MigrationResult[] | string, Error>> {
  try {
    const driver = getDriver()
    if (['sqlite', 'mysql', 'postgres'].includes(driver)) {
      const hasBeenMigrated = hasJobsMigrationBeenCreated()

      if (!hasBeenMigrated) {
        // Generate SQL based on driver
        let migrationContent = ''

        if (driver === 'sqlite') {
          migrationContent = `-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  queue TEXT NOT NULL DEFAULT 'default',
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  reserved_at INTEGER,
  available_at INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

-- Create failed_jobs table
CREATE TABLE IF NOT EXISTS failed_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  connection TEXT NOT NULL,
  queue TEXT NOT NULL,
  payload TEXT NOT NULL,
  exception TEXT NOT NULL,
  failed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`
        }
        else if (driver === 'mysql') {
          migrationContent = `-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  queue VARCHAR(255) NOT NULL DEFAULT 'default',
  payload LONGTEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  reserved_at INT UNSIGNED NULL,
  available_at INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL
);

-- Create failed_jobs table
CREATE TABLE IF NOT EXISTS failed_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(255) NOT NULL,
  connection VARCHAR(255) NOT NULL,
  queue VARCHAR(255) NOT NULL,
  payload LONGTEXT NOT NULL,
  exception LONGTEXT NOT NULL,
  failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`
        }
        else if (driver === 'postgres') {
          migrationContent = `-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  queue VARCHAR(255) NOT NULL DEFAULT 'default',
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  reserved_at INTEGER,
  available_at INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

-- Create failed_jobs table
CREATE TABLE IF NOT EXISTS failed_jobs (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(255) NOT NULL,
  connection VARCHAR(255) NOT NULL,
  queue VARCHAR(255) NOT NULL,
  payload TEXT NOT NULL,
  exception TEXT NOT NULL,
  failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`
        }

        const timestamp = new Date().getTime().toString()
        const migrationFileName = `${timestamp}-create-jobs-table.sql`
        const migrationsPath = getMigrationsPath()

        // Ensure migrations directory exists
        if (!existsSync(migrationsPath)) {
          mkdirSync(migrationsPath, { recursive: true })
        }

        const migrationFilePath = join(migrationsPath, migrationFileName)
        writeFileSync(migrationFilePath, migrationContent)

        console.log('✓ Created jobs migration file')
      }
      else {
        console.log('✓ Jobs migration file already exists')
      }

      // Now run the migration if tables don't exist
      const tablesExist = await jobsTableExists()

      if (!tablesExist) {
        console.log('  Running migration...')

        // Check if SQLite database file exists - use SQLite directly
        const sqlitePath = getDatabasePath()
        if (driver === 'sqlite' || existsSync(sqlitePath)) {
          const sqlite = new Database(sqlitePath)

          sqlite.run(`CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            queue TEXT NOT NULL DEFAULT 'default',
            payload TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            reserved_at INTEGER,
            available_at INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME
          )`)

          sqlite.run(`CREATE TABLE IF NOT EXISTS failed_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            connection TEXT NOT NULL,
            queue TEXT NOT NULL,
            payload TEXT NOT NULL,
            exception TEXT NOT NULL,
            failed_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`)

          sqlite.close()
        }
        else if (driver === 'mysql') {
          const { db } = await import('../utils')
          await (db as any).unsafe(`CREATE TABLE IF NOT EXISTS jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            queue VARCHAR(255) NOT NULL DEFAULT 'default',
            payload LONGTEXT NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            reserved_at INT UNSIGNED NULL,
            available_at INT UNSIGNED NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL
          )`).execute()

          await (db as any).unsafe(`CREATE TABLE IF NOT EXISTS failed_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            uuid VARCHAR(255) NOT NULL,
            connection VARCHAR(255) NOT NULL,
            queue VARCHAR(255) NOT NULL,
            payload LONGTEXT NOT NULL,
            exception LONGTEXT NOT NULL,
            failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`).execute()
        }
        else if (driver === 'postgres') {
          const { db } = await import('../utils')
          await (db as any).unsafe(`CREATE TABLE IF NOT EXISTS jobs (
            id SERIAL PRIMARY KEY,
            queue VARCHAR(255) NOT NULL DEFAULT 'default',
            payload TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            reserved_at INTEGER,
            available_at INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP
          )`).execute()

          await (db as any).unsafe(`CREATE TABLE IF NOT EXISTS failed_jobs (
            id SERIAL PRIMARY KEY,
            uuid VARCHAR(255) NOT NULL,
            connection VARCHAR(255) NOT NULL,
            queue VARCHAR(255) NOT NULL,
            payload TEXT NOT NULL,
            exception TEXT NOT NULL,
            failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`).execute()
        }

        console.log('✓ Jobs and failed_jobs tables created')
      }
      else {
        console.log('✓ Jobs tables already exist')
      }
    }

    return ok('Migration created and executed.') as any
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}
