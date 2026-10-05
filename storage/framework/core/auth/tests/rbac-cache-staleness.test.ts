import { afterEach, describe, expect, it } from 'bun:test'
import { config } from '@stacksjs/config'
import * as R from '../src/rbac'

/**
 * The RBAC cache kept a revoked permission indefinitely, two ways:
 *
 * - A revoke that landed while a read was in flight deleted an entry that was
 *   not cached yet; the read then cached the permission the revoke had just
 *   removed, with no expiry.
 * - The cache is per process, so a revoke made by another worker was never
 *   seen at all.
 */
const perms = [{ id: 1, name: 'posts.delete', guard_name: 'web' }]
let granted = new Set<number>()
let hold: Promise<void> | null = null

function store(): any {
  return {
    findPermissionByName: async (name: string) => perms.find(p => p.name === name) ?? null,
    async getUserPermissions() {
      const snapshot = perms.filter(p => granted.has(p.id))
      if (hold) await hold
      return snapshot
    },
    async removePermissionFromUser(_user: number, id: number) { granted.delete(id) },
  }
}

const savedAuth = config.auth

afterEach(() => {
  ;(config as any).auth = savedAuth
  hold = null
  R.flushRbacCache()
})

describe('RBAC cache', () => {
  it('does not cache what a read saw if a revoke landed while it was in flight', async () => {
    granted = new Set([1])
    R.setRbacStore(store())

    let release!: () => void
    hold = new Promise<void>(resolve => (release = resolve))
    const inFlight = R.hasPermission(7, 'posts.delete')
    await Bun.sleep(1)
    await R.revokePermission(7, 'posts.delete')
    hold = null
    release()

    // The read that started before the revoke may answer as it saw things...
    expect(await inFlight).toBe(true)
    // ...but it must not leave that answer behind.
    expect(await R.hasPermission(7, 'posts.delete')).toBe(false)
  })

  it('sees a revoke made elsewhere once the cache entry expires', async () => {
    ;(config as any).auth = { ...savedAuth, rbacCacheTtl: 20 }
    granted = new Set([1])
    R.setRbacStore(store())

    expect(await R.hasPermission(8, 'posts.delete')).toBe(true)
    granted.delete(1) // another worker's revoke, straight to the database
    expect(await R.hasPermission(8, 'posts.delete')).toBe(true) // still cached here
    await Bun.sleep(30)
    expect(await R.hasPermission(8, 'posts.delete')).toBe(false)
  })

  it('caches nothing with a TTL of zero', async () => {
    ;(config as any).auth = { ...savedAuth, rbacCacheTtl: 0 }
    granted = new Set([1])
    R.setRbacStore(store())

    expect(await R.hasPermission(9, 'posts.delete')).toBe(true)
    granted.delete(1)
    expect(await R.hasPermission(9, 'posts.delete')).toBe(false)
  })
})
