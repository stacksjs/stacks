import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { preprocessSqliteMigrations } from '../src/migrations'

// stacksjs/stacks#1916 — `preprocessSqliteMigrations` used to
// `unlinkSync` every FK / unique-index migration file from disk on
// SQLite. That meant a future `DB_CONNECTION=mysql` (or postgres)
// switch had no migration files to replay, so production databases
// silently ended up with zero foreign keys.
//
// The post-fix contract:
//   - Portable migrations that just don't apply to SQLite (FK
//     ADD CONSTRAINT) are *recorded as executed* but stay on disk so
//     they can replay when the dialect changes.
//   - CREATE UNIQUE INDEX files are NOT skipped or recorded — the SQLite
//     dialect driver never renders inline UNIQUE in CREATE TABLE, so the
//     standalone index file is the only uniqueness enforcement on SQLite
//     (stacksjs/stacks#1952).
//   - Genuinely dead files (duplicate CREATE TABLE created by buddy
//     regeneration, DROP COLUMN of a column that doesn't exist) are
//     still deleted — they wouldn't be useful on any dialect.

describe('preprocessSqliteMigrations — keep portable files (stacksjs/stacks#1916)', () => {
  let workspace: string
  let migrationsDir: string
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    workspace = mkdtempSync(join(tmpdir(), 'preprocess-sqlite-'))
    migrationsDir = join(workspace, 'database', 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    process.chdir(workspace)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(workspace, { recursive: true, force: true })
  })

  it('keeps ALTER TABLE ADD CONSTRAINT files on disk (portable to MySQL/Postgres)', () => {
    const fkFile = join(migrationsDir, '0000000010-alter-posts-user_id.sql')
    writeFileSync(fkFile, 'ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;')

    preprocessSqliteMigrations()

    expect(existsSync(fkFile)).toBe(true)
  })

  it('keeps CREATE UNIQUE INDEX files on disk (portable to MySQL/Postgres)', () => {
    const idxFile = join(migrationsDir, '0000000011-create-users_email_unique-index-in-users.sql')
    writeFileSync(idxFile, 'CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");')

    preprocessSqliteMigrations()

    expect(existsSync(idxFile)).toBe(true)
  })

  it('still deletes duplicate CREATE TABLE files (genuinely dead)', () => {
    const earlier = join(migrationsDir, '0000000001-create-users-table.sql')
    const later = join(migrationsDir, '0000000050-create-users-table.sql')
    writeFileSync(earlier, 'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY);')
    writeFileSync(later, 'CREATE TABLE "users" ("id" INTEGER PRIMARY KEY);')

    preprocessSqliteMigrations()

    // Earlier survives; the duplicate is gone.
    expect(existsSync(earlier)).toBe(true)
    expect(existsSync(later)).toBe(false)
  })

  it('does not touch normal CREATE TABLE / CREATE INDEX migrations', () => {
    const createTable = join(migrationsDir, '0000000001-create-posts-table.sql')
    const regularIdx = join(migrationsDir, '0000000002-create-some-index-in-posts.sql')
    writeFileSync(createTable, 'CREATE TABLE "posts" ("id" INTEGER PRIMARY KEY, "title" TEXT);')
    writeFileSync(regularIdx, 'CREATE INDEX "posts_title_idx" ON "posts" ("title");')

    preprocessSqliteMigrations()

    expect(existsSync(createTable)).toBe(true)
    expect(existsSync(regularIdx)).toBe(true)
  })

  it('survives an empty migrations directory', () => {
    expect(() => preprocessSqliteMigrations()).not.toThrow()
    expect(readdirSync(migrationsDir)).toEqual([])
  })
})

describe('preprocessSqliteMigrations — unique-index files must run (stacksjs/stacks#1952)', () => {
  let workspace: string
  let migrationsDir: string
  let originalCwd: string

  // Same relative path the module resolves against process.cwd() — the
  // tests run with DB_DATABASE_PATH unset.
  const dbRelativePath = join('database', 'stacks.sqlite')

  beforeEach(() => {
    originalCwd = process.cwd()
    workspace = mkdtempSync(join(tmpdir(), 'preprocess-sqlite-'))
    migrationsDir = join(workspace, 'database', 'migrations')
    mkdirSync(migrationsDir, { recursive: true })
    process.chdir(workspace)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    rmSync(workspace, { recursive: true, force: true })
  })

  // Creates the SQLite DB with the migrations tracking table (same DDL the
  // preprocessor uses) plus a bare users table, and runs extra setup SQL.
  const createDb = (...setupSql: string[]): string => {
    const dbPath = join(workspace, dbRelativePath)
    const db = new Database(dbPath)
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`)
      db.exec('CREATE TABLE users ("id" INTEGER PRIMARY KEY, "email" TEXT)')
      for (const sql of setupSql) db.exec(sql)
    }
    finally { db.close() }
    return dbPath
  }

  const migrationRecord = (dbPath: string, file: string): unknown => {
    const db = new Database(dbPath, { readonly: true })
    try {
      return db.prepare('SELECT migration FROM migrations WHERE migration = ?').get(file)
    }
    finally { db.close() }
  }

  const idxFileName = '0000000096-create-users_email_unique-index-in-users.sql'
  const idxSql = 'CREATE UNIQUE INDEX IF NOT EXISTS "users_users_email_unique" ON "users" ("email");'

  it('does not record CREATE UNIQUE INDEX files as executed', () => {
    const idxFile = join(migrationsDir, idxFileName)
    writeFileSync(idxFile, idxSql)
    const dbPath = createDb()

    preprocessSqliteMigrations()

    // The old skip logic recorded the file without ever creating the
    // index, so `email: { unique: true }` was never enforced.
    expect(existsSync(idxFile)).toBe(true)
    expect(migrationRecord(dbPath, idxFileName)).toBeNull()
  })

  it('un-records a unique-index migration the old skip logic marked executed', () => {
    writeFileSync(join(migrationsDir, idxFileName), idxSql)
    const dbPath = createDb(`INSERT INTO migrations (migration) VALUES ('${idxFileName}')`)

    preprocessSqliteMigrations()

    // Index missing from sqlite_master — the record must be removed so
    // the runner replays the file and finally creates the index.
    expect(migrationRecord(dbPath, idxFileName)).toBeNull()
  })

  it('keeps the record when the unique index actually exists', () => {
    writeFileSync(join(migrationsDir, idxFileName), idxSql)
    const dbPath = createDb(
      'CREATE UNIQUE INDEX "users_users_email_unique" ON "users" ("email")',
      `INSERT INTO migrations (migration) VALUES ('${idxFileName}')`,
    )

    preprocessSqliteMigrations()

    expect(migrationRecord(dbPath, idxFileName)).not.toBeNull()
  })

  it('still records ADD CONSTRAINT files as executed (#1916 contract unchanged)', () => {
    const fkFileName = '0000000010-alter-posts-user_id.sql'
    writeFileSync(join(migrationsDir, fkFileName), 'ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;')
    const dbPath = createDb()

    preprocessSqliteMigrations()

    expect(migrationRecord(dbPath, fkFileName)).not.toBeNull()
  })

  it('repo hygiene: no checked-in unique-index migration is a SELECT 1 stub', () => {
    // The pre-fix preprocessor rewrote 9 unique-index migrations in
    // database/migrations/ to `SELECT 1;` stubs — restored as part of
    // #1952. Guards against the stubs regressing.
    const repoMigrationsDir = join(import.meta.dir, '../../../../../database/migrations')
    const files = readdirSync(repoMigrationsDir).filter(f => /unique-index-in-.*\.sql$/.test(f))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const content = readFileSync(join(repoMigrationsDir, file), 'utf-8')
      expect(content).not.toContain('SELECT 1')
      expect(content).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS/i)
    }
  })
})
