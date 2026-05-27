import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
//   - Portable migrations that just don't apply to SQLite (FK, unique
//     index) are *recorded as executed* but stay on disk so they can
//     replay when the dialect changes.
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
