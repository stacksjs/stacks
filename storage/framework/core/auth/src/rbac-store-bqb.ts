/**
 * RBAC store backed by `@stacksjs/database` (which proxies bun-query-builder).
 *
 * Implements the {@link RbacStore} interface defined in `./rbac.ts` against the
 * five tables created by migrations `0000000101`-`0000000105`:
 *
 *   - `roles`             (id, name, guard_name, description, timestamps)
 *   - `permissions`       (id, name, guard_name, description, timestamps)
 *   - `user_roles`        (user_id, role_id, created_at; PK on the pair)
 *   - `user_permissions`  (user_id, permission_id, created_at; PK on the pair)
 *   - `role_permissions`  (role_id, permission_id, created_at; PK on the pair)
 *
 * The store stays cache-free — `rbac.ts` owns the in-memory cache around every
 * call site. We just translate interface methods into SQL.
 *
 * The composite primary keys on the three pivot tables mean duplicate
 * assignments produce a unique-constraint violation rather than corrupting
 * state. We catch the dialect-specific shapes in `swallowDuplicate()` so
 * `assignRoleToUser(1, 5)` is idempotent — calling it twice is a no-op,
 * not an error.
 */

import type { PermissionRecord, RbacStore, RoleRecord } from './rbac'
import { db } from '@stacksjs/database'
// `isUniqueViolation` now lives in the cycle-free `@stacksjs/orm` package so
// every framework write path (auto-CRUD routes, commerce/cms) can share it —
// see stacksjs/stacks#1957. Re-exported here so existing consumers
// (register.ts, rbac-seed.ts, the tests) keep their './rbac-store-bqb'
// import paths unchanged. auth already statically imports @stacksjs/orm
// (register.ts imports User), so this adds no new dependency edge.
import { isUniqueViolation } from '@stacksjs/orm'

export { isUniqueViolation }

/**
 * Swallow unique-constraint violations. Anything else is re-thrown so a
 * "connection lost" mid-INSERT doesn't get silently treated as
 * "already assigned".
 *
 * Exported for direct unit testing — the live pivot helpers below also use it.
 */
export function swallowDuplicate(err: unknown): void {
  if (!isUniqueViolation(err))
    throw err
}

/**
 * Map a raw DB row to a typed record. Both `roles` and `permissions` share
 * the same shape, so one mapper covers both — the call site provides the
 * generic. Exported for unit testing.
 */
export function toRecord<T extends RoleRecord | PermissionRecord>(row: Record<string, unknown> | undefined): T | null {
  if (!row)
    return null
  return {
    id: Number(row.id),
    name: String(row.name),
    guard_name: String(row.guard_name),
    description: row.description == null ? undefined : String(row.description),
    created_at: row.created_at == null ? undefined : String(row.created_at),
    updated_at: row.updated_at == null ? undefined : String(row.updated_at),
  } as T
}

/**
 * Insert a row, fetch it back, return the typed record. Avoids dialect-
 * specific `RETURNING` quirks (MySQL doesn't support it) and the
 * `LAST_INSERT_ID()` dance — at the cost of one extra SELECT per create,
 * which is a rare op.
 */
async function insertAndFetch(
  table: 'roles' | 'permissions',
  name: string,
  guardName: string,
  description?: string,
): Promise<RoleRecord | PermissionRecord> {
  await (db.insertInto(table) as any)
    .values({ name, guard_name: guardName, description: description ?? null })
    .execute()

  const row = await (db.selectFrom(table) as any)
    .selectAll()
    .where('name', '=', name)
    .where('guard_name', '=', guardName)
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst()

  const rec = toRecord<RoleRecord | PermissionRecord>(row)
  if (!rec) {
    // The INSERT succeeded above; if the read can't find the row something
    // is very wrong (cross-connection visibility, schema mismatch). Surface
    // it loudly instead of returning a fake record.
    throw new Error(`[rbac] insertAndFetch(${table}, ${name}, ${guardName}) succeeded but follow-up SELECT returned nothing`)
  }
  return rec
}

/**
 * `bun-query-builder`'s built-in `insertOrIgnore` hardcodes
 * `ON CONFLICT DO NOTHING`, which works on SQLite + Postgres but is a
 * syntax error on MySQL. For the three pivot tables we go through a
 * SELECT-then-INSERT path that's portable, with `swallowDuplicate()` as a
 * defence-in-depth against the race between SELECT and INSERT.
 */
async function pivotAttach(
  table: 'user_roles' | 'user_permissions' | 'role_permissions',
  cols: Record<string, number>,
): Promise<void> {
  // Cheap existence check first — avoids most INSERTs in the steady state
  // where a user/role pair is already present (the common case once roles
  // are seeded).
  let q = db.selectFrom(table).select('user_id' in cols ? 'user_id' : 'role_id') as any
  for (const [k, v] of Object.entries(cols))
    q = q.where(k, '=', v)
  const existing = await q.limit(1).executeTakeFirst()
  if (existing)
    return

  try {
    await (db.insertInto(table) as any).values(cols).execute()
  }
  catch (err) {
    swallowDuplicate(err)
  }
}

async function pivotDetach(
  table: 'user_roles' | 'user_permissions' | 'role_permissions',
  cols: Record<string, number>,
): Promise<void> {
  let q = db.deleteFrom(table) as any
  for (const [k, v] of Object.entries(cols))
    q = q.where(k, '=', v)
  await q.execute()
}

async function pivotDetachAll(
  table: 'user_roles' | 'user_permissions' | 'role_permissions',
  column: 'user_id' | 'role_id',
  value: number,
): Promise<void> {
  await (db.deleteFrom(table) as any).where(column, '=', value).execute()
}

async function pivotSync(
  table: 'user_roles' | 'user_permissions' | 'role_permissions',
  ownerColumn: 'user_id' | 'role_id',
  ownerId: number,
  targetColumn: 'role_id' | 'permission_id',
  targetIds: number[],
): Promise<void> {
  // Replace-all semantics: drop existing rows for the owner, then bulk
  // insert the new set. Wrapped in a transaction so a crash between
  // the DELETE and the INSERT (process killed mid-call, DB connection
  // dropped, etc.) doesn't leave the user with zero roles/permissions
  // — that's a privilege wipe (admin silently demoted to anonymous)
  // not a sync-in-progress state. See stacksjs/stacks#1860 H-7.
  //
  // Dedupe so the same id passed twice in `syncUserRoles` doesn't trip
  // the composite PK on the second row in a multi-row INSERT.
  const unique = Array.from(new Set(targetIds))

  await db.transaction(async (rawTrx) => {
    // bun-query-builder's transaction callback yields a `QueryBuilder<DB>`
    // whose chained methods are typed optional. Mirror the shape of the
    // top-level `db` proxy so the chains type-check identically.
    const trx = rawTrx as unknown as typeof db
    await (trx.deleteFrom(table) as any).where(ownerColumn, '=', ownerId).execute()
    if (unique.length === 0) return

    const rows = unique.map(id => ({ [ownerColumn]: ownerId, [targetColumn]: id }))
    try {
      await (trx.insertInto(table) as any).values(rows).execute()
    }
    catch (err) {
      // Concurrent sync race; fall back to one-by-one with idempotent attach
      // inside the same transaction so a partial-success still rolls back
      // cleanly if a later iteration throws.
      swallowDuplicate(err)
      for (const id of unique) {
        try {
          await (trx.insertInto(table) as any).values({ [ownerColumn]: ownerId, [targetColumn]: id }).execute()
        }
        catch (innerErr) {
          swallowDuplicate(innerErr)
        }
      }
    }
  })
}

export function createBqbRbacStore(): RbacStore {
  return {
    // ─── Roles ────────────────────────────────────────────────────────

    async findRoleByName(name: string, guardName: string = 'web'): Promise<RoleRecord | null> {
      const row = await (db.selectFrom('roles') as any)
        .selectAll()
        .where('name', '=', name)
        .where('guard_name', '=', guardName)
        .limit(1)
        .executeTakeFirst()
      return toRecord<RoleRecord>(row)
    },

    async findRoleById(id: number): Promise<RoleRecord | null> {
      const row = await (db.selectFrom('roles') as any)
        .selectAll()
        .where('id', '=', id)
        .limit(1)
        .executeTakeFirst()
      return toRecord<RoleRecord>(row)
    },

    async createRole(name: string, guardName: string = 'web', description?: string): Promise<RoleRecord> {
      return (await insertAndFetch('roles', name, guardName, description)) as RoleRecord
    },

    async deleteRole(id: number): Promise<void> {
      // Cascade-clean the pivots so a deleted role doesn't leave orphan
      // rows in `user_roles` / `role_permissions`. We don't use DB-level
      // FK CASCADE because the existing Stacks migrations are FK-free
      // (app-layer integrity is the convention) — replicating that here
      // keeps the table-level contract consistent.
      await (db.deleteFrom('user_roles') as any).where('role_id', '=', id).execute()
      await (db.deleteFrom('role_permissions') as any).where('role_id', '=', id).execute()
      await (db.deleteFrom('roles') as any).where('id', '=', id).execute()
    },

    async getAllRoles(guardName?: string): Promise<RoleRecord[]> {
      let q = (db.selectFrom('roles') as any).selectAll() as any
      if (guardName)
        q = q.where('guard_name', '=', guardName)
      const rows: Array<Record<string, unknown>> = await q.orderBy('id', 'asc').execute()
      return rows.map(r => toRecord<RoleRecord>(r)!).filter(Boolean)
    },

    // ─── Permissions ──────────────────────────────────────────────────

    async findPermissionByName(name: string, guardName: string = 'web'): Promise<PermissionRecord | null> {
      const row = await (db.selectFrom('permissions') as any)
        .selectAll()
        .where('name', '=', name)
        .where('guard_name', '=', guardName)
        .limit(1)
        .executeTakeFirst()
      return toRecord<PermissionRecord>(row)
    },

    async findPermissionById(id: number): Promise<PermissionRecord | null> {
      const row = await (db.selectFrom('permissions') as any)
        .selectAll()
        .where('id', '=', id)
        .limit(1)
        .executeTakeFirst()
      return toRecord<PermissionRecord>(row)
    },

    async createPermission(name: string, guardName: string = 'web', description?: string): Promise<PermissionRecord> {
      return (await insertAndFetch('permissions', name, guardName, description)) as PermissionRecord
    },

    async deletePermission(id: number): Promise<void> {
      await (db.deleteFrom('user_permissions') as any).where('permission_id', '=', id).execute()
      await (db.deleteFrom('role_permissions') as any).where('permission_id', '=', id).execute()
      await (db.deleteFrom('permissions') as any).where('id', '=', id).execute()
    },

    async getAllPermissions(guardName?: string): Promise<PermissionRecord[]> {
      let q = (db.selectFrom('permissions') as any).selectAll() as any
      if (guardName)
        q = q.where('guard_name', '=', guardName)
      const rows: Array<Record<string, unknown>> = await q.orderBy('id', 'asc').execute()
      return rows.map(r => toRecord<PermissionRecord>(r)!).filter(Boolean)
    },

    // ─── User-Role pivot ──────────────────────────────────────────────

    async getUserRoles(userId: number): Promise<RoleRecord[]> {
      // INNER JOIN so deleted-but-still-referenced roles don't surface
      // as half-empty rows. `selectAllRelations` or aliased `selectAll`
      // would also work, but the explicit column list keeps the result
      // shape obvious.
      //
      // Two bqb API contracts to keep in mind:
      //   1. `innerJoin(table, onLeft, op, onRight)` is FOUR-arg —
      //      the `'='` is not optional. The prior 3-arg form silently
      //      compiled to `ON onLeft onRight undefined`, which SQLite
      //      rejects with `near "<table>": syntax error`.
      //   2. `.select(['a','b'])` (array) accumulates a multi-column
      //      SELECT in one call. Chained `.select('a').select('b')`
      //      REPLACES the SELECT clause each time — only the last
      //      column survives. Array form is the correct shape when
      //      you want >1 column.
      const rows: Array<Record<string, unknown>> = await (db.selectFrom('roles') as any)
        .innerJoin('user_roles', 'user_roles.role_id', '=', 'roles.id')
        .select([
          'roles.id as id',
          'roles.name as name',
          'roles.guard_name as guard_name',
          'roles.description as description',
          'roles.created_at as created_at',
          'roles.updated_at as updated_at',
        ])
        .where('user_roles.user_id', '=', userId)
        .orderBy('roles.id', 'asc')
        .execute()
      return rows.map(r => toRecord<RoleRecord>(r)!).filter(Boolean)
    },

    assignRoleToUser(userId: number, roleId: number): Promise<void> {
      return pivotAttach('user_roles', { user_id: userId, role_id: roleId })
    },

    removeRoleFromUser(userId: number, roleId: number): Promise<void> {
      return pivotDetach('user_roles', { user_id: userId, role_id: roleId })
    },

    removeAllRolesFromUser(userId: number): Promise<void> {
      return pivotDetachAll('user_roles', 'user_id', userId)
    },

    syncUserRoles(userId: number, roleIds: number[]): Promise<void> {
      return pivotSync('user_roles', 'user_id', userId, 'role_id', roleIds)
    },

    // ─── User-Permission pivot ────────────────────────────────────────

    async getUserDirectPermissions(userId: number): Promise<PermissionRecord[]> {
      // See `getUserRoles` above for the bqb API contracts on
      // `innerJoin(..., '=', ...)` and array-form `.select([])`.
      const rows: Array<Record<string, unknown>> = await (db.selectFrom('permissions') as any)
        .innerJoin('user_permissions', 'user_permissions.permission_id', '=', 'permissions.id')
        .select([
          'permissions.id as id',
          'permissions.name as name',
          'permissions.guard_name as guard_name',
          'permissions.description as description',
          'permissions.created_at as created_at',
          'permissions.updated_at as updated_at',
        ])
        .where('user_permissions.user_id', '=', userId)
        .orderBy('permissions.id', 'asc')
        .execute()
      return rows.map(r => toRecord<PermissionRecord>(r)!).filter(Boolean)
    },

    assignPermissionToUser(userId: number, permissionId: number): Promise<void> {
      return pivotAttach('user_permissions', { user_id: userId, permission_id: permissionId })
    },

    removePermissionFromUser(userId: number, permissionId: number): Promise<void> {
      return pivotDetach('user_permissions', { user_id: userId, permission_id: permissionId })
    },

    removeAllPermissionsFromUser(userId: number): Promise<void> {
      return pivotDetachAll('user_permissions', 'user_id', userId)
    },

    syncUserPermissions(userId: number, permissionIds: number[]): Promise<void> {
      return pivotSync('user_permissions', 'user_id', userId, 'permission_id', permissionIds)
    },

    // ─── Role-Permission pivot ────────────────────────────────────────

    async getRolePermissions(roleId: number): Promise<PermissionRecord[]> {
      // See `getUserRoles` above for the bqb API contracts on
      // `innerJoin(..., '=', ...)` and array-form `.select([])`.
      const rows: Array<Record<string, unknown>> = await (db.selectFrom('permissions') as any)
        .innerJoin('role_permissions', 'role_permissions.permission_id', '=', 'permissions.id')
        .select([
          'permissions.id as id',
          'permissions.name as name',
          'permissions.guard_name as guard_name',
          'permissions.description as description',
          'permissions.created_at as created_at',
          'permissions.updated_at as updated_at',
        ])
        .where('role_permissions.role_id', '=', roleId)
        .orderBy('permissions.id', 'asc')
        .execute()
      return rows.map(r => toRecord<PermissionRecord>(r)!).filter(Boolean)
    },

    assignPermissionToRole(roleId: number, permissionId: number): Promise<void> {
      return pivotAttach('role_permissions', { role_id: roleId, permission_id: permissionId })
    },

    removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
      return pivotDetach('role_permissions', { role_id: roleId, permission_id: permissionId })
    },

    syncRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
      return pivotSync('role_permissions', 'role_id', roleId, 'permission_id', permissionIds)
    },
  }
}
