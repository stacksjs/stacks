import { describe, expect, test } from 'bun:test'
import {
  migrateRbacTables,
  permissionsTableSql,
  rolePermissionsTableSql,
  rolesTableSql,
  userPermissionsTableSql,
  userRolesTableSql,
} from '../src/rbac-tables'
import { sqlHelpers } from '../src/sql-helpers'

/**
 * RBAC tables migration (stacksjs/stacks#1941 Phase A).
 *
 * The DDL builders are pure, so we assert generated SQL per dialect
 * without a live connection (mirroring the auth-tables pattern this
 * follows). `migrateRbacTables` is the thin executor wired into
 * `buddy migrate` after auth + notification tables.
 */

describe('RBAC table DDL — cross-dialect (stacksjs/stacks#1941 Phase A)', () => {
  test('exports the migrator + pure builders', () => {
    expect(typeof migrateRbacTables).toBe('function')
    expect(typeof rolesTableSql).toBe('function')
    expect(typeof permissionsTableSql).toBe('function')
    expect(typeof userRolesTableSql).toBe('function')
    expect(typeof userPermissionsTableSql).toBe('function')
    expect(typeof rolePermissionsTableSql).toBe('function')
  })

  for (const driver of ['sqlite', 'mysql', 'postgres'] as const) {
    describe(driver, () => {
      const sql = sqlHelpers(driver)

      test('roles has name + guard_name + UNIQUE(name, guard_name)', () => {
        const ddl = rolesTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS roles')
        for (const col of ['name', 'guard_name', 'description', 'created_at', 'updated_at'])
          expect(ddl).toContain(col)
        expect(ddl).toContain('UNIQUE (name, guard_name)')
        expect(ddl).toContain(sql.pkColumn)
      })

      test('permissions mirrors roles', () => {
        const ddl = permissionsTableSql(sql)
        expect(ddl).toContain('CREATE TABLE IF NOT EXISTS permissions')
        expect(ddl).toContain('UNIQUE (name, guard_name)')
        for (const col of ['name', 'guard_name', 'description'])
          expect(ddl).toContain(col)
      })

      test(`guard_name defaults to 'web'`, () => {
        expect(rolesTableSql(sql)).toContain(`DEFAULT 'web'`)
        expect(permissionsTableSql(sql)).toContain(`DEFAULT 'web'`)
      })
    })
  }

  describe('pivot tables (composite primary keys)', () => {
    test('user_roles PK is (user_id, role_id)', () => {
      const ddl = userRolesTableSql()
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_roles')
      expect(ddl).toContain('PRIMARY KEY (user_id, role_id)')
    })

    test('user_permissions PK is (user_id, permission_id)', () => {
      const ddl = userPermissionsTableSql()
      expect(ddl).toContain('PRIMARY KEY (user_id, permission_id)')
    })

    test('role_permissions PK is (role_id, permission_id)', () => {
      const ddl = rolePermissionsTableSql()
      expect(ddl).toContain('PRIMARY KEY (role_id, permission_id)')
    })

    test('every pivot carries created_at', () => {
      for (const ddl of [userRolesTableSql(), userPermissionsTableSql(), rolePermissionsTableSql()])
        expect(ddl).toContain('created_at')
    })
  })
})
