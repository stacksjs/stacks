/**
 * Tests for the bun-query-builder-backed RBAC store + the five RBAC
 * migrations that back it (stacksjs/stacks#1843).
 *
 * Strategy:
 *
 *   - Pure helper tests run in-process against `swallowDuplicate` and
 *     `toRecord` — they don't need a DB.
 *
 *   - Migration tests run the five SQL files against an in-memory SQLite
 *     instance via `bun:sqlite` and assert on the resulting schema. This
 *     verifies the migrations are syntactically valid and produce the
 *     columns/indexes/constraints the store relies on. We use raw SQLite
 *     here (not the framework's `db` proxy) because the proxy reaches for
 *     env-configured connections that test-isolation cares about avoiding.
 *
 *   - Full integration of the store against a live DB is exercised via
 *     `./buddy migrate` + manual smoke through `/api/dashboard/auth/me`.
 *     Reproducing that whole boot path inside `bun test` would require
 *     either bootstrapping the framework or mocking `@stacksjs/database`
 *     past the point of testing the actual code under test.
 */

import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isUniqueViolation, swallowDuplicate, toRecord } from '../src/rbac-store-bqb'
import type { PermissionRecord, RoleRecord } from '../src/rbac'

const MIGRATION_DIR = join(import.meta.dir, '../../../../../database/migrations')
const MIGRATIONS = [
  '0000000101-create-roles-table.sql',
  '0000000102-create-permissions-table.sql',
  '0000000103-create-user_roles-table.sql',
  '0000000104-create-user_permissions-table.sql',
  '0000000105-create-role_permissions-table.sql',
]

function applyMigrations(db: Database): void {
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(MIGRATION_DIR, file), 'utf8')
    db.exec(sql)
  }
}

// ─── swallowDuplicate ───────────────────────────────────────────────

describe('swallowDuplicate', () => {
  test('swallows SQLITE_CONSTRAINT_UNIQUE errors', () => {
    expect(() => swallowDuplicate({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).not.toThrow()
  })

  test('swallows generic SQLITE_CONSTRAINT errors', () => {
    expect(() => swallowDuplicate({ code: 'SQLITE_CONSTRAINT' })).not.toThrow()
  })

  test('swallows MySQL ER_DUP_ENTRY (errno 1062)', () => {
    expect(() => swallowDuplicate({ errno: 1062 })).not.toThrow()
  })

  test('swallows Postgres unique_violation (code 23505)', () => {
    expect(() => swallowDuplicate({ code: '23505' })).not.toThrow()
  })

  test('swallows errors with "unique" in the message', () => {
    expect(() => swallowDuplicate({ message: 'UNIQUE constraint failed: roles.name' })).not.toThrow()
    expect(() => swallowDuplicate({ message: 'Duplicate entry for key user_roles.PRIMARY' })).not.toThrow()
  })

  test('rethrows non-duplicate errors (connection lost, syntax, …)', () => {
    expect(() => swallowDuplicate({ code: 'ECONNRESET', message: 'connection lost' })).toThrow()
    expect(() => swallowDuplicate(new Error('syntax error near "INSERT"'))).toThrow()
    expect(() => swallowDuplicate({})).toThrow()
    expect(() => swallowDuplicate(null)).toThrow()
  })
})

// ─── isUniqueViolation ──────────────────────────────────────────────

// The predicate swallowDuplicate is built on, exported for callers
// that map duplicates to their own error instead of swallowing them
// (register()'s 409 — stacksjs/stacks#1953).
describe('isUniqueViolation', () => {
  test('true for the dialect-specific duplicate shapes', () => {
    expect(isUniqueViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).toBe(true)
    expect(isUniqueViolation({ code: 'SQLITE_CONSTRAINT' })).toBe(true)
    expect(isUniqueViolation({ errno: 1062 })).toBe(true)
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
  })

  test('true for unique/duplicate message text fallbacks', () => {
    expect(isUniqueViolation({ message: 'UNIQUE constraint failed: users.email' })).toBe(true)
    expect(isUniqueViolation({ message: 'Duplicate entry for key users.email' })).toBe(true)
  })

  test('false for anything else', () => {
    expect(isUniqueViolation({ code: 'ECONNRESET', message: 'connection lost' })).toBe(false)
    expect(isUniqueViolation(new Error('syntax error near "INSERT"'))).toBe(false)
    expect(isUniqueViolation({})).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

// ─── toRecord ───────────────────────────────────────────────────────

describe('toRecord', () => {
  test('returns null for undefined / missing rows', () => {
    expect(toRecord<RoleRecord>(undefined)).toBeNull()
  })

  test('coerces id to a number even when the driver returns it as a string', () => {
    const r = toRecord<RoleRecord>({ id: '7', name: 'admin', guard_name: 'web' })!
    expect(r.id).toBe(7)
    expect(typeof r.id).toBe('number')
  })

  test('normalises null description / timestamps to undefined', () => {
    const r = toRecord<RoleRecord>({
      id: 1,
      name: 'admin',
      guard_name: 'web',
      description: null,
      created_at: null,
      updated_at: null,
    })!
    expect(r.description).toBeUndefined()
    expect(r.created_at).toBeUndefined()
    expect(r.updated_at).toBeUndefined()
  })

  test('preserves non-null string fields verbatim', () => {
    const r = toRecord<PermissionRecord>({
      id: 5,
      name: 'posts.publish',
      guard_name: 'api',
      description: 'Publish blog posts',
      created_at: '2026-05-19T00:00:00.000Z',
      updated_at: '2026-05-19T00:00:00.000Z',
    })!
    expect(r.name).toBe('posts.publish')
    expect(r.guard_name).toBe('api')
    expect(r.description).toBe('Publish blog posts')
    expect(r.created_at).toBe('2026-05-19T00:00:00.000Z')
    expect(r.updated_at).toBe('2026-05-19T00:00:00.000Z')
  })
})

// ─── Migrations 0000000101-0000000105 ───────────────────────────────

describe('RBAC migration schema', () => {
  test('all five files are syntactically valid SQLite', () => {
    const db = new Database(':memory:')
    expect(() => applyMigrations(db)).not.toThrow()
    db.close()
  })

  test('roles table has the columns rbac.ts expects in RoleRecord', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const cols = db.query(`PRAGMA table_info(roles)`).all() as Array<{ name: string }>
    const names = cols.map(c => c.name)
    expect(names).toEqual(expect.arrayContaining(['id', 'name', 'guard_name', 'description', 'created_at', 'updated_at']))
    db.close()
  })

  test('permissions table has the columns rbac.ts expects in PermissionRecord', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const cols = db.query(`PRAGMA table_info(permissions)`).all() as Array<{ name: string }>
    const names = cols.map(c => c.name)
    expect(names).toEqual(expect.arrayContaining(['id', 'name', 'guard_name', 'description', 'created_at', 'updated_at']))
    db.close()
  })

  test('roles enforces unique (name, guard_name)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO roles (name, guard_name) VALUES ('admin', 'web')`)
    // Same name + same guard → duplicate
    expect(() => db.run(`INSERT INTO roles (name, guard_name) VALUES ('admin', 'web')`)).toThrow()
    // Same name + different guard → allowed
    expect(() => db.run(`INSERT INTO roles (name, guard_name) VALUES ('admin', 'api')`)).not.toThrow()

    db.close()
  })

  test('permissions enforces unique (name, guard_name)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO permissions (name, guard_name) VALUES ('posts.publish', 'web')`)
    expect(() => db.run(`INSERT INTO permissions (name, guard_name) VALUES ('posts.publish', 'web')`)).toThrow()
    expect(() => db.run(`INSERT INTO permissions (name, guard_name) VALUES ('posts.publish', 'api')`)).not.toThrow()

    db.close()
  })

  test('user_roles has composite PK on (user_id, role_id)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO roles (name, guard_name) VALUES ('admin', 'web')`)
    db.run(`INSERT INTO user_roles (user_id, role_id) VALUES (1, 1)`)

    // Same pair twice → PK violation
    expect(() => db.run(`INSERT INTO user_roles (user_id, role_id) VALUES (1, 1)`)).toThrow()

    // Different user, same role → allowed
    expect(() => db.run(`INSERT INTO user_roles (user_id, role_id) VALUES (2, 1)`)).not.toThrow()

    db.close()
  })

  test('user_permissions has composite PK on (user_id, permission_id)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO permissions (name, guard_name) VALUES ('posts.publish', 'web')`)
    db.run(`INSERT INTO user_permissions (user_id, permission_id) VALUES (1, 1)`)
    expect(() => db.run(`INSERT INTO user_permissions (user_id, permission_id) VALUES (1, 1)`)).toThrow()
    expect(() => db.run(`INSERT INTO user_permissions (user_id, permission_id) VALUES (2, 1)`)).not.toThrow()

    db.close()
  })

  test('role_permissions has composite PK on (role_id, permission_id)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO roles (name, guard_name) VALUES ('admin', 'web')`)
    db.run(`INSERT INTO permissions (name, guard_name) VALUES ('posts.publish', 'web')`)
    db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (1, 1)`)
    expect(() => db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (1, 1)`)).toThrow()
    expect(() => db.run(`INSERT INTO role_permissions (role_id, permission_id) VALUES (1, 2)`)).not.toThrow()

    db.close()
  })

  test('guard_name defaults to "web" when omitted', () => {
    const db = new Database(':memory:')
    applyMigrations(db)

    db.run(`INSERT INTO roles (name) VALUES ('editor')`)
    const row = db.query(`SELECT guard_name FROM roles WHERE name = 'editor'`).get() as { guard_name: string }
    expect(row.guard_name).toBe('web')

    db.close()
  })

  test('user_roles.role_id index exists (lookup hot path)', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const idx = db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'user_roles'`).all() as Array<{ name: string }>
    expect(idx.map(i => i.name)).toContain('user_roles_role_id_index')
    db.close()
  })
})
