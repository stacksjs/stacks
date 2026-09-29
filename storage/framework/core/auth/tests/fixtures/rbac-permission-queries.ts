import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const file = process.env.STACKS_RBAC_PERMISSIONS_DB
assert(file && basename(dirname(file)).startsWith('stacks-rbac-permissions-'))
assert.equal(process.env.DB_CONNECTION, 'sqlite')
assert.equal(process.env.DB_DATABASE_PATH, file)
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, closeDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'sqlite', connections: { sqlite: { database: file } }, queryLogging: { enabled: false },
} })
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createBqbRbacStore } = await import('../../src/rbac-store-bqb')
const { flushRbacCache, getUserPermissions, setRbacStore } = await import('../../src/rbac')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')

try {
  await ensureFrameworkAuthTables()
  await db.unsafe("CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT NOT NULL, guard_name TEXT NOT NULL, description TEXT, created_at DATETIME, updated_at DATETIME)").execute()
  await db.unsafe("CREATE TABLE permissions (id INTEGER PRIMARY KEY, name TEXT NOT NULL, guard_name TEXT NOT NULL, description TEXT, created_at DATETIME, updated_at DATETIME)").execute()
  await db.unsafe("CREATE TABLE user_roles (user_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (user_id, role_id))").execute()
  await db.unsafe("CREATE TABLE user_permissions (user_id INTEGER NOT NULL, permission_id INTEGER NOT NULL, PRIMARY KEY (user_id, permission_id))").execute()
  await db.unsafe("CREATE TABLE role_permissions (role_id INTEGER NOT NULL, permission_id INTEGER NOT NULL, PRIMARY KEY (role_id, permission_id))").execute()
  await db.insertInto('roles').values([
    { id: 1, name: 'writer', guard_name: 'web' },
    { id: 2, name: 'auditor', guard_name: 'api' },
  ]).execute()
  await db.insertInto('permissions').values([
    { id: 1, name: 'posts:read', guard_name: 'web' },
    { id: 2, name: 'posts:write', guard_name: 'web' },
    { id: 3, name: 'audit:read', guard_name: 'api' },
  ]).execute()
  await db.insertInto('user_roles').values([
    { user_id: 7, role_id: 1 },
    { user_id: 7, role_id: 2 },
  ]).execute()
  await db.insertInto('user_permissions').values({ user_id: 7, permission_id: 1 }).execute()
  await db.insertInto('role_permissions').values([
    { role_id: 1, permission_id: 1 },
    { role_id: 1, permission_id: 2 },
    { role_id: 2, permission_id: 3 },
  ]).execute()

  setRbacStore(createBqbRbacStore())
  flushRbacCache()
  let reads = 0
  const unregister = registerPersistentQueryHooks({
    onQueryStart(event) {
      if (event.kind === 'select' && /(?:permissions|roles)/i.test(event.sql))
        reads++
    },
  })
  try {
    const permissions = await getUserPermissions(7)
    assert.deepEqual(permissions.map(permission => `${permission.guard_name}:${permission.name}`), [
      'web:posts:read',
      'web:posts:write',
      'api:audit:read',
    ])
    assert.equal(reads, 1, 'a cold permission lookup must use one set-based database read')
    assert.deepEqual(await getUserPermissions(7), permissions)
    assert.equal(reads, 1, 'a warm permission lookup must stay in the bounded cache')
  }
  finally { unregister() }

  console.log('RBAC permission query count OK')
}
finally { await closeDatabaseConnection() }
