/**
 * The migration generator leaves the auth layer's tables alone.
 *
 * `PersonalAccessToken` maps `oauth_access_tokens`, which `migrateAuthTables()`
 * creates. An app whose model snapshot predated that model was handed a
 * `create-oauth_access_tokens-table.sql` built from the model's attributes -
 * no `user_id`, no `oauth_client_id` - and wherever it ran first, the auth
 * layer's CREATE IF NOT EXISTS became a no-op and its backfill failed with
 * "no such column: user_id" (smakelo, upgrading to 0.75.11).
 */

import type { MigrationPlan } from '@stacksjs/query-builder'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { AUTH_TABLES } from '../src/auth-tables'
import { withoutRuntimeOwnedTableSql } from '../src/migrations'

describe('AUTH_TABLES', () => {
  it('names exactly the tables migrateAuthTables creates', () => {
    const source = readFileSync(join(import.meta.dir, '../src/auth-tables.ts'), 'utf8')
    const created = [...source.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(match => match[1])
    expect([...AUTH_TABLES].sort()).toEqual([...new Set(created)].sort() as string[])
  })
})

describe('withoutRuntimeOwnedTableSql', () => {
  it('drops every generated statement aimed at an auth table, and nothing else', () => {
    const statements = [
      'CREATE TABLE IF NOT EXISTS "oauth_access_tokens" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "tokenable_type" TEXT, "token" TEXT)',
      'CREATE INDEX IF NOT EXISTS "oauth_access_tokens_token_idx" ON "oauth_access_tokens" ("token")',
      'ALTER TABLE "oauth_access_tokens" ADD COLUMN "label" TEXT',
      'PRAGMA foreign_keys=OFF;\nBEGIN;\nCREATE TABLE "_qb_tmp_passkeys" ("id" TEXT);\nINSERT INTO "_qb_tmp_passkeys" ("id") SELECT "id" FROM "passkeys";\nDROP TABLE "passkeys";\nALTER TABLE "_qb_tmp_passkeys" RENAME TO "passkeys";\nCOMMIT;\nPRAGMA foreign_keys=ON',
      'DROP TABLE IF EXISTS "password_resets"',
      'CREATE TABLE IF NOT EXISTS "referrals" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "user_id" INTEGER REFERENCES "users"("id"))',
      'ALTER TABLE "users" ADD COLUMN "nickname" TEXT',
    ]

    const { statements: kept, removed } = withoutRuntimeOwnedTableSql(statements)
    expect(kept).toEqual(statements.slice(5))
    expect(removed).toHaveLength(5)
  })
})

describe('an app whose snapshot predates PersonalAccessToken', () => {
  const ORIGINAL = process.env.DB_SNAPSHOT_PATH
  let dir: string

  beforeEach(() => {
    const committed = JSON.parse(readFileSync(join(import.meta.dir, '../../../database/model-snapshot.sqlite.json'), 'utf8')).plan as MigrationPlan
    expect(committed.tables.some(table => table.table === 'oauth_access_tokens')).toBe(true)
    const plan = { ...committed, tables: committed.tables.filter(table => table.table !== 'oauth_access_tokens') }

    dir = mkdtempSync(join(tmpdir(), 'pre-token-model-snapshot-'))
    writeFileSync(join(dir, 'model-snapshot.sqlite.json'), JSON.stringify({ plan, dialect: 'sqlite' }, null, 2))
    process.env.DB_SNAPSHOT_PATH = dir
  })

  afterEach(() => {
    if (ORIGINAL === undefined)
      delete process.env.DB_SNAPSHOT_PATH
    else
      process.env.DB_SNAPSHOT_PATH = ORIGINAL
    rmSync(dir, { recursive: true, force: true })
  })

  it('has nothing pending for oauth_access_tokens', async () => {
    const { pendingMigrationOperations } = await import('../src/migrations')
    const operations = await pendingMigrationOperations({ fromDb: false, applyRenames: true })
    expect(operations.map(op => `${op.kind} ${op.table}`)).toEqual([])
  }, 60_000)
})
