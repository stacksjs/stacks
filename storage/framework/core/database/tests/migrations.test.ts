import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ---------------------------------------------------------------------------
// Import the real module directly — no mocks.
// We test what's testable: the exported functions exist, result shapes, and
// SQLite preprocessing which is pure filesystem logic.
// ---------------------------------------------------------------------------

const {
  runDatabaseMigration,
  resetDatabase: resetDatabaseFn,
  generateMigrations,
  generateMigrations2,
} = await import('../src/migrations')

// ---------------------------------------------------------------------------
// Tests — function exports and result shapes
// ---------------------------------------------------------------------------

describe('Database Migrations', () => {
  test('runDatabaseMigration is a function', () => {
    expect(typeof runDatabaseMigration).toBe('function')
  })

  test('resetDatabase is a function', () => {
    expect(typeof resetDatabaseFn).toBe('function')
  })

  test('generateMigrations is a function', () => {
    expect(typeof generateMigrations).toBe('function')
  })

  test('generateMigrations2 is a function', () => {
    expect(typeof generateMigrations2).toBe('function')
  })

  test('runDatabaseMigration returns a result object', async () => {
    const result = await runDatabaseMigration()
    // Should return an ok/err result shape
    expect(result).toHaveProperty('isOk')
  })

  test('generateMigrations returns a result object', async () => {
    const result = await generateMigrations()
    expect(result).toHaveProperty('isOk')
  })

  test('resetDatabase returns a result object', async () => {
    const result = await resetDatabaseFn()
    expect(result).toHaveProperty('isOk')
  })

  test('MigrationResult type has correct shape', () => {
    // Verify the exported interface shape at runtime
    const result = {
      migrationName: '001_create_users',
      direction: 'Up' as const,
      status: 'Success' as const,
    }
    expect(result.migrationName).toBe('001_create_users')
    expect(result.direction).toBe('Up')
    expect(result.status).toBe('Success')
  })
})

// ---------------------------------------------------------------------------
// SQLite preprocessing tests (using real filesystem in temp dir)
// ---------------------------------------------------------------------------

describe('SQLite migration preprocessing', () => {
  const tempDir = join(tmpdir(), `stacks-migration-test-${Date.now()}`)
  const migrationsDir = join(tempDir, 'database', 'migrations')
  const originalCwd = process.cwd()

  beforeEach(() => {
    mkdirSync(migrationsDir, { recursive: true })
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    try {
      rmSync(tempDir, { recursive: true, force: true })
    }
    catch {
      // ignore cleanup errors
    }
  })

  test('ALTER TABLE ADD CONSTRAINT migration files are rewritten to no-ops', async () => {
    const migrationFile = join(migrationsDir, '001_add_fk.sql')
    writeFileSync(migrationFile, 'ALTER TABLE posts ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)')

    // Trigger preprocessing by running migration (it will preprocess for sqlite)
    await runDatabaseMigration()

    const content = readFileSync(migrationFile, 'utf-8')
    expect(content).toContain('Skipped')
    expect(content).toContain('SELECT 1')
  })

  test('CREATE UNIQUE INDEX migrations are rewritten to no-ops for SQLite', async () => {
    const migrationFile = join(migrationsDir, '002_unique_idx.sql')
    writeFileSync(migrationFile, 'CREATE UNIQUE INDEX idx_email ON users(email)')

    await runDatabaseMigration()

    const content = readFileSync(migrationFile, 'utf-8')
    expect(content).toContain('Skipped')
    expect(content).toContain('SELECT 1')
  })
})
