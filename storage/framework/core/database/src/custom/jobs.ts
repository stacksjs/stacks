import type { Result } from '@stacksjs/error-handling'
import type { MigrationResult } from '../migrations'
import { err, ok } from '@stacksjs/error-handling'
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

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

        console.log('✓ Created jobs migration')
      }
      else {
        console.log('✓ Jobs migration already created')
      }
    }

    return ok('Migration created.')
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}
