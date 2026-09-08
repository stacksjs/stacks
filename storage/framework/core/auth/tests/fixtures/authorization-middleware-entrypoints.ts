import assert from 'node:assert/strict'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import type { RbacStore } from '@stacksjs/auth/rbac'
import { defineRouteModelBinding, enhanceRequest, runWithRequest } from '@stacksjs/router'

const root = `${import.meta.dir}/../../../../../..`
const modules = new Map()
for (const name of ['Team', 'EnsureEmailIsVerified', 'Can', 'Role', 'Permission']) {
  modules.set(name, (await import(`${root}/storage/framework/defaults/app/Middleware/${name}.ts`)).default)
}
const auth = await import('@stacksjs/auth')
const gate = await import('@stacksjs/auth/gate')
const rbac = await import('@stacksjs/auth/rbac')
const users = await import('@stacksjs/auth/middleware')
assert.equal(auth.Gate, gate.Gate)
assert.equal(auth.AuthorizationException, gate.AuthorizationException)
assert.equal(auth.setRbacStore, rbac.setRbacStore)
assert.equal(auth.authenticatedUser, users.authenticatedUser)

// A registered store exercises real RBAC lookups and caches. Unexpected store
// operations throw instead of silently supplying a permissive test default.
let privilegedUserId = 1
const reads = {
  async getUserRoles(id: number) {
    return [{ id, name: id === privilegedUserId ? 'admin' : 'viewer', guard_name: 'web' }]
  },
  async getUserDirectPermissions() { return [] },
  async getRolePermissions(id: number) {
    return id === privilegedUserId ? [{ id: 11, name: 'edit', guard_name: 'web' }] : []
  },
}
auth.setRbacStore(new Proxy(reads, {
  get(target, key) {
    assert(key in target, `Unexpected RBAC store operation: ${String(key)}`)
    return Reflect.get(target, key)
  },
}) as unknown as RbacStore)
auth.Gate.define('entrypoint-edit', (user, document: { ownerId: number }) => user?.id === document?.ownerId)
defineRouteModelBinding('document', value => ({ id: Number(value), ownerId: 1 }))

async function check(name: string, user: Record<string, unknown> | undefined, params: Record<string, string> = {}, status?: number) {
  const req = enhanceRequest(new Request('https://example.test/protected') as EnhancedRequest)
  req._authenticatedUser = user
  req._middlewareParams = params
  req.params = { document: '17' }
  await runWithRequest(req, async () => {
    if (status) {
      await assert.rejects(() => modules.get(name).handle(req), (error: { status?: number }) => error.status === status)
    }
    else {
      assert.equal(await modules.get(name).handle(req), undefined)
    }
  })
}

await check('Team', undefined, {}, 401)
await check('Team', { id: 1 }, {}, 403)
await check('Team', { id: 1, team_id: 8, team_role: 'owner' }, { team: 'owner' })
await check('Team', { id: 1, team_id: 8, team_role: 'member' }, { team: 'owner' }, 403)
await check('EnsureEmailIsVerified', undefined, {}, 401)
await check('EnsureEmailIsVerified', { id: 1 }, {}, 403)
await check('EnsureEmailIsVerified', { id: 1, email_verified_at: '2026-09-08 00:00:00' })
for (const [name, key, value] of [['Role', 'role', 'admin'], ['Permission', 'permission', 'edit']]) {
  await check(name, undefined, {}, undefined)
  await check(name, undefined, { [key]: value }, 401)
  await check(name, { id: 1 }, { [key]: value })
  await check(name, { id: 2 }, { [key]: value }, 403)
}
// Warm middleware must still use each request's requirements and the current
// root RBAC store/cache, including changes to inherited permissions.
for (const privileged of [2, 1]) {
  privilegedUserId = privileged
  auth.flushRbacCache()
  const other = privileged === 1 ? 2 : 1
  await Promise.all([
    check('Role', { id: privileged }, { role: 'missing, admin' }),
    check('Role', { id: other }, { role: 'admin' }, 403),
    check('Role', { id: privileged }, { role: 'viewer' }, 403),
    check('Permission', { id: privileged }, { permission: 'missing, edit' }),
    check('Permission', { id: other }, { permission: 'edit' }, 403),
    check('Permission', { id: privileged }, { permission: 'publish' }, 403),
  ])
}

// Replacing the store must invalidate earlier grants. This store grants only
// a direct permission, so Role must refuse while Permission still allows.
const replacement = {
  async getUserRoles() { return [] },
  async getUserDirectPermissions() { return [{ id: 12, name: 'publish', guard_name: 'web' }] },
  async getRolePermissions() { return [] },
}
auth.setRbacStore(new Proxy(replacement, {
  get(target, key) {
    assert(key in target, `Unexpected RBAC store operation: ${String(key)}`)
    return Reflect.get(target, key)
  },
}) as unknown as RbacStore)
await check('Role', { id: 1 }, { role: 'admin' }, 403)
await check('Permission', { id: 1 }, { permission: 'edit' }, 403)
await check('Permission', { id: 1 }, { permission: 'publish' })

await check('Can', { id: 1 }, { can: 'entrypoint-edit,document' })
await check('Can', { id: 2 }, { can: 'entrypoint-edit,document' }, 403)
await check('Can', undefined, { can: 'entrypoint-edit,document' }, 403)
await check('Can', { id: 1 }, { can: 'entrypoint-unregistered' }, 403)
console.log('PASS shared gate/RBAC state, model binding and five authorization middleware contracts')
