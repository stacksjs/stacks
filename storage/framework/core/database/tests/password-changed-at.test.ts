import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { usersPasswordChangedAtSql } from '../src/auth-tables'
import { sqlHelpers } from '../src/sql-helpers'

/**
 * stacksjs/stacks#1957 — token validity is bound to the user's
 * credential state via `users.password_changed_at`: `resetPassword()`
 * stamps it and the token-validation paths reject any token issued
 * before the stamp. No generated users migration creates the column, so
 * a defensive, dialect-aware ALTER is declared once as a pure builder in
 * auth-tables.ts and executed (failure-swallowed) from both schema
 * paths: `migrateAuthTables()` and the `buddy auth:setup` action.
 */

describe('users.password_changed_at defensive ALTER (stacksjs/stacks#1957)', () => {
  describe('per-dialect DDL', () => {
    test('sqlite', () => {
      expect(usersPasswordChangedAtSql(sqlHelpers('sqlite')))
        .toBe('ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP')
    })

    test('postgres', () => {
      expect(usersPasswordChangedAtSql(sqlHelpers('postgres')))
        .toBe('ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP')
    })

    test('mysql needs an explicit NULL modifier (implicit NOT NULL otherwise)', () => {
      expect(usersPasswordChangedAtSql(sqlHelpers('mysql')))
        .toBe('ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL')
    })
  })

  describe('behavioral (bun:sqlite, committed users schema)', () => {
    const MIGRATION = resolve(__dirname, '../../../../..', 'database/migrations/0000000044-create-users-table.sql')

    function freshUsersDb(): Database {
      const db = new Database(':memory:')
      db.exec(readFileSync(MIGRATION, 'utf8'))
      db.run(`INSERT INTO users (name, email, password) VALUES ('U', 'u@example.com', 'hash')`)
      return db
    }

    test('pre-fix failure mode: stamping the column throws "no such column"', () => {
      const db = freshUsersDb()
      expect(() => db.run(`UPDATE users SET password_changed_at = '2026-01-01 00:00:00' WHERE id = 1`))
        .toThrow(/no such column/i)
      db.close()
    })

    test('post-ALTER the same UPDATE succeeds and the value reads back', () => {
      const db = freshUsersDb()
      db.exec(usersPasswordChangedAtSql(sqlHelpers('sqlite')))
      db.run(`UPDATE users SET password_changed_at = '2026-01-01 00:00:00' WHERE id = 1`)
      const row = db.query('SELECT password_changed_at FROM users WHERE id = 1').get() as any
      expect(row.password_changed_at).toBe('2026-01-01 00:00:00')
      db.close()
    })

    test('re-running the ALTER throws duplicate-column — the swallow both call sites rely on', () => {
      const db = freshUsersDb()
      const ddl = usersPasswordChangedAtSql(sqlHelpers('sqlite'))
      db.exec(ddl)
      expect(() => db.exec(ddl)).toThrow(/duplicate column/i)
      db.close()
    })
  })

  describe('wiring', () => {
    test('migrateAuthTables executes the builder inside a try block', () => {
      const source = readFileSync(resolve(__dirname, '../src/auth-tables.ts'), 'utf-8')
      const fnIdx = source.indexOf('export async function migrateAuthTables')
      expect(fnIdx).toBeGreaterThan(-1)
      const body = source.slice(fnIdx)
      // Guarded execution: the ALTER must be swallowed so reruns (or a
      // missing users table) don't fail the whole migrate step.
      expect(body).toMatch(/try\s*\{\s*await db\.unsafe\(usersPasswordChangedAtSql\(sql\)\)/)
    })
  })
})
