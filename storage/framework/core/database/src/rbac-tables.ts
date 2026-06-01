/**
 * RBAC Tables Migration (stacksjs/stacks#1941 Phase A)
 *
 * Ships the 5 role/permission tables the auth layer's `RbacStore`
 * expects (schema documented in `auth/src/rbac-store-bqb.ts:5-11`,
 * but no migration was previously shipped — apps had to hand-roll it
 * or rely on cached state). Mirrors `auth-tables.ts` /
 * `notification-tables.ts`: pure cross-dialect DDL builders + a thin
 * `migrateRbacTables()` executor, wired into `buddy migrate`.
 *
 * - `roles`            (id, name, guard_name, description, timestamps; UNIQUE(name, guard_name))
 * - `permissions`      (id, name, guard_name, description, timestamps; UNIQUE(name, guard_name))
 * - `user_roles`       (user_id, role_id, created_at; composite PK)
 * - `user_permissions` (user_id, permission_id, created_at; composite PK)
 * - `role_permissions` (role_id, permission_id, created_at; composite PK)
 *
 * The composite PKs on the pivots make double-assignment a unique
 * violation rather than a duplicate row, matching the contract
 * `swallowDuplicate()` already relies on (`rbac-store-bqb.ts:41`).
 *
 * Views / Actions / middleware / seeders are Phase B — this phase is
 * just the missing schema so the existing RBAC store actually has
 * something to read.
 */

import { log } from '@stacksjs/logging'
import { env as envVars } from '@stacksjs/env'
import { db } from './utils'
import { sqlHelpers } from './sql-helpers'

type SqlHelpers = ReturnType<typeof sqlHelpers>

function getDbDriver(): string {
  return envVars.DB_CONNECTION || 'sqlite'
}

/** `roles` table — id + name + guard + timestamps with UNIQUE(name, guard_name). */
export function rolesTableSql(sql: SqlHelpers): string {
  const { pkColumn, nullableTimestamp } = sql
  return `CREATE TABLE IF NOT EXISTS roles (
    ${pkColumn},
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at ${nullableTimestamp},
    UNIQUE (name, guard_name)
  )`
}

/** `permissions` table — same shape as `roles`. */
export function permissionsTableSql(sql: SqlHelpers): string {
  const { pkColumn, nullableTimestamp } = sql
  return `CREATE TABLE IF NOT EXISTS permissions (
    ${pkColumn},
    name VARCHAR(255) NOT NULL,
    guard_name VARCHAR(255) NOT NULL DEFAULT 'web',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at ${nullableTimestamp},
    UNIQUE (name, guard_name)
  )`
}

/** `user_roles` pivot — composite PK makes double-assign a unique violation. */
export function userRolesTableSql(): string {
  return `CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
  )`
}

/** `user_permissions` pivot. */
export function userPermissionsTableSql(): string {
  return `CREATE TABLE IF NOT EXISTS user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id)
  )`
}

/** `role_permissions` pivot. */
export function rolePermissionsTableSql(): string {
  return `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
  )`
}

/**
 * Create the 5 RBAC tables. Idempotent (`IF NOT EXISTS`), so it's
 * safe to run on every `buddy migrate`.
 */
export async function migrateRbacTables(options: { verbose?: boolean } = {}): Promise<{ success: boolean, error?: string }> {
  const dbDriver = getDbDriver()
  const sql = sqlHelpers(dbDriver)

  if (options.verbose)
    log.info(`Creating RBAC tables for ${dbDriver}...`)

  try {
    if (options.verbose) log.info('Creating roles table...')
    await db.unsafe(rolesTableSql(sql)).execute()

    if (options.verbose) log.info('Creating permissions table...')
    await db.unsafe(permissionsTableSql(sql)).execute()

    if (options.verbose) log.info('Creating user_roles pivot...')
    await db.unsafe(userRolesTableSql()).execute()

    if (options.verbose) log.info('Creating user_permissions pivot...')
    await db.unsafe(userPermissionsTableSql()).execute()

    if (options.verbose) log.info('Creating role_permissions pivot...')
    await db.unsafe(rolePermissionsTableSql()).execute()

    if (options.verbose) log.success('RBAC tables created')
    return { success: true }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Failed to create RBAC tables: ${message}`)
    return { success: false, error: message }
  }
}
