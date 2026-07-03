import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensureUuidColumns, findUuidTables, uuidColumnSql } from '../src/uuid-columns'
import { sqlHelpers } from '../src/sql-helpers'

/**
 * stacksjs/status#1 Phase 9 — the `useUuid` model trait (declared on 79
 * default models, `User` included) makes the ORM's insert path write a
 * `uuid` value on every `Model.create(...)` call, but migration codegen
 * only emits the `uuid` column at the moment a model's CREATE TABLE
 * migration is generated. Toggle the trait on afterward — or just inherit
 * a default model that already has it — and nothing regenerates that
 * migration, because `copyModelFiles`'s change-detection only diffs
 * `model.attributes`, never `model.traits`. Confirmed empirically: 59 of
 * this repo's 63 committed `create-*-table` migrations (including
 * `users`) lack a `uuid` column despite their model declaring the trait,
 * so `Model.create(...)` throws `no such column: uuid` on a freshly
 * migrated database for the vast majority of `useUuid` models.
 *
 * Unlike the passkeys/two_factor/stripe_id gaps in auth-tables.ts, this
 * isn't fixable with a hardcoded ALTER against one table — the trait
 * spans dozens of tables across userland and framework-default models.
 * `ensureUuidColumns()` walks the real model files, resolves every table
 * whose model has `useUuid: true`, and guarantee-ALTERs each one.
 */

describe('uuid column guarantee (stacksjs/status#1 Phase 9)', () => {
  describe('per-dialect DDL', () => {
    test('sqlite', () => {
      expect(uuidColumnSql('users', sqlHelpers('sqlite'))).toBe('ALTER TABLE users ADD COLUMN uuid TEXT')
    })

    test('mysql', () => {
      expect(uuidColumnSql('users', sqlHelpers('mysql'))).toBe('ALTER TABLE users ADD COLUMN uuid VARCHAR(255)')
    })

    test('postgres', () => {
      expect(uuidColumnSql('users', sqlHelpers('postgres'))).toBe('ALTER TABLE users ADD COLUMN uuid UUID')
    })
  })

  describe('model-trait discovery (real model files, not mocked)', () => {
    test('finds `users` among the resolved uuid tables — User declares `useUuid: true`', async () => {
      const tables = await findUuidTables()
      expect(tables).toContain('users')
    })

    test('finds a broad set of tables, not just `users` — this is a framework-wide trait, not a users-only fix', async () => {
      const tables = await findUuidTables()
      // 79 default models declare the trait as of this fix; assert generously
      // so the test doesn't churn every time a model is added/removed.
      expect(tables.length).toBeGreaterThan(20)
    })
  })

  describe('behavioral (bun:sqlite, committed users schema)', () => {
    const MIGRATION = resolve(__dirname, '../../../../..', 'database/migrations/0000000044-create-users-table.sql')

    function freshUsersDb(): Database {
      const db = new Database(':memory:')
      db.exec(readFileSync(MIGRATION, 'utf8'))
      return db
    }

    test('pre-fix failure mode: creating a user with a uuid value throws "has no column named uuid" — the exact reported bug', () => {
      const db = freshUsersDb()
      expect(() => db.run(
        `INSERT INTO users (uuid, name, email, password) VALUES (?, ?, ?, ?)`,
        ['11111111-1111-1111-1111-111111111111', 'Test', 'test@example.com', 'hash'],
      )).toThrow(/has no column named uuid/i)
      db.close()
    })

    test('post-ALTER (ensureUuidColumns\' DDL) the same create succeeds and the uuid reads back', () => {
      const db = freshUsersDb()
      db.exec(uuidColumnSql('users', sqlHelpers('sqlite')))
      db.run(
        `INSERT INTO users (uuid, name, email, password) VALUES (?, ?, ?, ?)`,
        ['11111111-1111-1111-1111-111111111111', 'Test', 'test@example.com', 'hash'],
      )
      const row = db.query('SELECT uuid FROM users WHERE email = ?').get('test@example.com') as any
      expect(row.uuid).toBe('11111111-1111-1111-1111-111111111111')
      db.close()
    })

    test('re-running the ALTER throws duplicate-column — the swallow ensureUuidColumns relies on', () => {
      const db = freshUsersDb()
      const ddl = uuidColumnSql('users', sqlHelpers('sqlite'))
      db.exec(ddl)
      expect(() => db.exec(ddl)).toThrow(/duplicate column/i)
      db.close()
    })
  })

  describe('wiring', () => {
    test('ensureUuidColumns resolves tables via findUuidTables() and swallows failures per table', () => {
      const source = readFileSync(resolve(__dirname, '../src/uuid-columns.ts'), 'utf-8')
      const fnIdx = source.indexOf('export async function ensureUuidColumns')
      expect(fnIdx).toBeGreaterThan(-1)
      const body = source.slice(fnIdx)
      expect(body).toMatch(/await findUuidTables\(\)/)
      expect(body).toMatch(/try\s*\{\s*await db\.unsafe\(uuidColumnSql\(table, sql\)\)/)
    })

    test('buddy migrate runs ensureUuidColumns after model migrations, not gated behind --auth', () => {
      const source = readFileSync(resolve(__dirname, '../../buddy/src/commands/migrate.ts'), 'utf-8')
      const migrateCmdIdx = source.indexOf(`.command('migrate',`)
      const freshCmdIdx = source.indexOf(`.command('migrate:fresh',`)
      expect(migrateCmdIdx).toBeGreaterThan(-1)
      expect(freshCmdIdx).toBeGreaterThan(-1)

      const migrateBody = source.slice(migrateCmdIdx, freshCmdIdx)
      expect(migrateBody).toMatch(/await ensureUuidColumns\(sqlHelpers\(driver\), \{ verbose: options\.verbose \}\)/)

      const freshBody = source.slice(freshCmdIdx)
      expect(freshBody).toMatch(/await ensureUuidColumns\(sqlHelpers\(driver\), \{ verbose: options\.verbose \}\)/)
    })
  })
})
