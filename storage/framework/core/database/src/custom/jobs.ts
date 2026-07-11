import type { Result } from '@stacksjs/error-handling'
import type { MigrationResult } from '../migrations'
import { err, ok } from '@stacksjs/error-handling'
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import Database from 'bun:sqlite'

// Use environment variables via @stacksjs/env for proper type coercion
import { env as envVars } from '@stacksjs/env'

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

async function jobBatchesTableExists(): Promise<boolean> {
  const sqlitePath = getDatabasePath()
  if (existsSync(sqlitePath)) {
    try {
      const sqlite = new Database(sqlitePath)
      const result = sqlite.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='job_batches'`).get()
      sqlite.close()
      return result !== null
    }
    catch {
      // Fall through
    }
  }

  const driver = getDriver()
  if (driver !== 'sqlite') {
    try {
      const { db } = await import('../utils')
      await (db as any).selectFrom('job_batches').select('id').limit(1).execute()
      return true
    }
    catch {
      return false
    }
  }

  return false
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

-- Create job_batches table
-- then_handler / catch_handler / finally_handler columns persist
-- the terminal handlers across worker restarts
-- (stacksjs/stacks#1883). Each holds JSON for one
-- PersistentBatchHandler. Nullable so callers that only use the
-- in-memory then(fn) API does not need to populate them.
CREATE TABLE IF NOT EXISTS job_batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  total_jobs INTEGER NOT NULL DEFAULT 0,
  pending_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_job_ids TEXT NOT NULL DEFAULT '[]',
  options TEXT,
  cancelled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  then_handler TEXT,
  catch_handler TEXT,
  finally_handler TEXT
);

-- Dead-letter queue (stacksjs/stacks#1885). Jobs that have already
-- been retried and failed again land here instead of cycling back
-- through the queue. \`reason\` distinguishes "repeat-failure" from
-- "poison-detected" / "circuit-broken" for operator triage.
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT NOT NULL,
  connection TEXT NOT NULL,
  queue TEXT NOT NULL,
  payload TEXT NOT NULL,
  exception TEXT NOT NULL,
  reason TEXT NOT NULL,
  total_failures INTEGER NOT NULL DEFAULT 1,
  first_failed_at DATETIME,
  last_failed_at DATETIME,
  dead_lettered_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Poison-message quarantine (stacksjs/stacks#1885). Tracks
-- failure counts per (jobName + payload-hash) over a rolling
-- window. When the count breaches the configured threshold, new
-- dispatches of that exact job+payload combination go directly to
-- the DLQ instead of the queue.
CREATE TABLE IF NOT EXISTS job_quarantine (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  quarantined_at DATETIME,
  UNIQUE(job_name, payload_hash)
);

-- Per-queue circuit-breaker state (stacksjs/stacks#1885). Tracks
-- success/failure counts in a rolling window so the worker can
-- pause a queue with a sustained high failure rate. Reads + writes
-- are best-effort; a missing row means "not tripped".
CREATE TABLE IF NOT EXISTS queue_circuit_state (
  queue_name TEXT PRIMARY KEY,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  paused_at DATETIME,
  resume_at DATETIME
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

-- Create job_batches table
-- then_handler / catch_handler / finally_handler persist
-- terminal handlers across worker restarts (stacksjs/stacks#1883).
CREATE TABLE IF NOT EXISTS job_batches (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  total_jobs INT NOT NULL DEFAULT 0,
  pending_jobs INT NOT NULL DEFAULT 0,
  failed_jobs INT NOT NULL DEFAULT 0,
  failed_job_ids LONGTEXT NOT NULL,
  options LONGTEXT,
  cancelled_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  then_handler LONGTEXT,
  catch_handler LONGTEXT,
  finally_handler LONGTEXT
);

-- DLQ + poison-quarantine + circuit-breaker (stacksjs/stacks#1885)
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid VARCHAR(255) NOT NULL,
  connection VARCHAR(255) NOT NULL,
  queue VARCHAR(255) NOT NULL,
  payload LONGTEXT NOT NULL,
  exception LONGTEXT NOT NULL,
  reason VARCHAR(64) NOT NULL,
  total_failures INT NOT NULL DEFAULT 1,
  first_failed_at TIMESTAMP NULL,
  last_failed_at TIMESTAMP NULL,
  dead_lettered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_quarantine (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_name VARCHAR(255) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  failure_count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quarantined_at TIMESTAMP NULL,
  UNIQUE KEY job_quarantine_unique (job_name, payload_hash)
);

CREATE TABLE IF NOT EXISTS queue_circuit_state (
  queue_name VARCHAR(255) PRIMARY KEY,
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paused_at TIMESTAMP NULL,
  resume_at TIMESTAMP NULL
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

-- Create job_batches table
-- then_handler / catch_handler / finally_handler persist
-- terminal handlers across worker restarts (stacksjs/stacks#1883).
CREATE TABLE IF NOT EXISTS job_batches (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  total_jobs INTEGER NOT NULL DEFAULT 0,
  pending_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_job_ids TEXT NOT NULL DEFAULT '[]',
  options TEXT,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  then_handler TEXT,
  catch_handler TEXT,
  finally_handler TEXT
);

-- DLQ + poison-quarantine + circuit-breaker (stacksjs/stacks#1885)
CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id SERIAL PRIMARY KEY,
  uuid VARCHAR(255) NOT NULL,
  connection VARCHAR(255) NOT NULL,
  queue VARCHAR(255) NOT NULL,
  payload TEXT NOT NULL,
  exception TEXT NOT NULL,
  reason VARCHAR(64) NOT NULL,
  total_failures INTEGER NOT NULL DEFAULT 1,
  first_failed_at TIMESTAMP,
  last_failed_at TIMESTAMP,
  dead_lettered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_quarantine (
  id SERIAL PRIMARY KEY,
  job_name VARCHAR(255) NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quarantined_at TIMESTAMP,
  UNIQUE (job_name, payload_hash)
);

CREATE TABLE IF NOT EXISTS queue_circuit_state (
  queue_name VARCHAR(255) PRIMARY KEY,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paused_at TIMESTAMP,
  resume_at TIMESTAMP
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

      // Create job_batches table if it doesn't exist
      const batchesExist = await jobBatchesTableExists()

      if (!batchesExist) {
        console.log('  Creating job_batches table...')

        const sqlitePath = getDatabasePath()
        if (driver === 'sqlite' || existsSync(sqlitePath)) {
          const sqlite = new Database(sqlitePath)

          sqlite.run(`CREATE TABLE IF NOT EXISTS job_batches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL DEFAULT '',
            total_jobs INTEGER NOT NULL DEFAULT 0,
            pending_jobs INTEGER NOT NULL DEFAULT 0,
            failed_jobs INTEGER NOT NULL DEFAULT 0,
            failed_job_ids TEXT NOT NULL DEFAULT '[]',
            options TEXT,
            cancelled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            finished_at DATETIME
          )`)

          sqlite.close()
        }
        else if (driver === 'mysql') {
          const { db } = await import('../utils')
          await (db as any).unsafe(`CREATE TABLE IF NOT EXISTS job_batches (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL DEFAULT '',
            total_jobs INT NOT NULL DEFAULT 0,
            pending_jobs INT NOT NULL DEFAULT 0,
            failed_jobs INT NOT NULL DEFAULT 0,
            failed_job_ids LONGTEXT NOT NULL,
            options LONGTEXT,
            cancelled_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP NULL
          )`).execute()
        }
        else if (driver === 'postgres') {
          const { db } = await import('../utils')
          await (db as any).unsafe(`CREATE TABLE IF NOT EXISTS job_batches (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL DEFAULT '',
            total_jobs INTEGER NOT NULL DEFAULT 0,
            pending_jobs INTEGER NOT NULL DEFAULT 0,
            failed_jobs INTEGER NOT NULL DEFAULT 0,
            failed_job_ids TEXT NOT NULL DEFAULT '[]',
            options TEXT,
            cancelled_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            finished_at TIMESTAMP
          )`).execute()
        }

        console.log('✓ job_batches table created')
      }
      else {
        console.log('✓ job_batches table already exists')
      }
    }

    return ok('Migration created and executed.') as any
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}
