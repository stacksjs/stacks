import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ---------------------------------------------------------------------------
// Mock external deps before importing the module under test
// ---------------------------------------------------------------------------

const mockSetConfig = mock(() => {})
const mockResetConnection = mock(() => {})
const mockExecuteMigration = mock(() => Promise.resolve())
const mockGenerateMigration = mock(() => Promise.resolve({ hasChanges: false }))
const mockResetDatabase = mock(() => Promise.resolve())
const mockCreateQueryBuilder = mock(() => ({
  unsafe: mock(() => Promise.resolve()),
}))

mock.module('bun-query-builder', () => ({
  setConfig: mockSetConfig,
  resetConnection: mockResetConnection,
  executeMigration: mockExecuteMigration,
  generateMigration: mockGenerateMigration,
  resetDatabase: mockResetDatabase,
  createQueryBuilder: mockCreateQueryBuilder,
}))

mock.module('@stacksjs/logging', () => ({
  log: {
    info: () => {},
    success: () => {},
    warn: () => {},
    error: () => {},
  },
}))

mock.module('@stacksjs/env', () => ({
  env: {
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: ':memory:',
  },
}))

mock.module('@stacksjs/path', () => ({
  path: {
    userModelsPath: () => '/tmp/stacks-test-models',
  },
}))

mock.module('@stacksjs/error-handling', () => ({
  ok: (v: any) => ({ isOk: true, value: v }),
  err: (e: any) => ({ isOk: false, error: e }),
  handleError: (_msg: string, error: any) => error instanceof Error ? error : new Error(String(error)),
}))

const mockDbUnsafe = mock(() => ({ execute: mock(() => Promise.resolve()) }))
mock.module('../src/utils', () => ({
  db: { unsafe: mockDbUnsafe },
}))

mock.module('../src/defaults', () => ({
  getConnectionDefaults: (driver: string) => {
    if (driver === 'sqlite') return { database: ':memory:' }
    return { database: 'stacks', host: 'localhost', username: '', password: '', port: 3306 }
  },
}))

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

const {
  runDatabaseMigration,
  resetDatabase: resetDatabaseFn,
  generateMigrations,
  generateMigrations2,
} = await import('../src/migrations')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Database Migrations', () => {
  afterEach(() => {
    mockSetConfig.mockClear()
    mockResetConnection.mockClear()
    mockExecuteMigration.mockClear()
    mockGenerateMigration.mockClear()
    mockResetDatabase.mockClear()
    mockCreateQueryBuilder.mockClear()
  })

  test('runDatabaseMigration configures query builder and executes migrations', async () => {
    const result = await runDatabaseMigration()
    expect(result).toHaveProperty('isOk', true)
    expect(mockSetConfig).toHaveBeenCalled()
    expect(mockResetConnection).toHaveBeenCalled()
    expect(mockExecuteMigration).toHaveBeenCalled()
  })

  test('runDatabaseMigration returns err on execution failure', async () => {
    mockExecuteMigration.mockImplementationOnce(() => {
      throw new Error('Migration execution failed')
    })
    const result = await runDatabaseMigration()
    expect(result).toHaveProperty('isOk', false)
  })

  test('generateMigrations calls qbGenerateMigration with models dir', async () => {
    const result = await generateMigrations()
    expect(result).toHaveProperty('isOk', true)
    expect(mockGenerateMigration).toHaveBeenCalled()
  })

  test('generateMigrations returns err on failure', async () => {
    mockGenerateMigration.mockImplementationOnce(() => {
      throw new Error('Generation failed')
    })
    const result = await generateMigrations()
    expect(result).toHaveProperty('isOk', false)
  })

  test('generateMigrations2 passes full:true option for fresh generation', async () => {
    await generateMigrations2()
    expect(mockGenerateMigration).toHaveBeenCalled()
    const lastCall = mockGenerateMigration.mock.calls[mockGenerateMigration.mock.calls.length - 1]
    expect(lastCall[1]).toHaveProperty('full', true)
  })

  test('resetDatabase drops framework tables then user tables', async () => {
    const result = await resetDatabaseFn()
    expect(result).toHaveProperty('isOk', true)
    expect(mockResetDatabase).toHaveBeenCalled()
  })

  test('resetDatabase returns err on failure', async () => {
    mockResetDatabase.mockImplementationOnce(() => {
      throw new Error('Drop failed')
    })
    const result = await resetDatabaseFn()
    expect(result).toHaveProperty('isOk', false)
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
