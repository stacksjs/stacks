/**
 * Tests for the default RBAC role-packs seeder (stacksjs/stacks#1843).
 *
 * The seeder is a thin orchestrator over `findRole` + `createRole` from
 * `rbac.ts`. Both go through the registered RBAC store, so we replace
 * the store with an in-memory implementation for the duration of these
 * tests — no real DB needed, and we get a clean read on idempotency.
 */

import type { RbacStore } from '../src/rbac'
import { beforeEach, describe, expect, test } from 'bun:test'
import { setRbacStore } from '../src/rbac'
import { DEFAULT_ROLE_PACKS, seedDefaultRoles } from '../src/rbac-seed'

function inMemoryStore(): RbacStore {
  const roles: any[] = []
  let nextId = 1

  return {
    async findRoleByName(name, guardName = 'web') {
      return roles.find(r => r.name === name && r.guard_name === guardName) ?? null
    },
    async findRoleById(id) {
      return roles.find(r => r.id === id) ?? null
    },
    async createRole(name, guardName = 'web', description) {
      const row = {
        id: nextId++,
        name,
        guard_name: guardName,
        description,
        created_at: '2026-05-19T00:00:00.000Z',
        updated_at: undefined,
      }
      roles.push(row)
      return row
    },
    deleteRole: async () => undefined,
    getAllRoles: async () => roles,
    // Permission/pivot ops aren't reached by the seeder — stubs are fine.
    findPermissionByName: async () => null,
    findPermissionById: async () => null,
    createPermission: async () => ({ id: 0, name: '', guard_name: '' } as any),
    deletePermission: async () => undefined,
    getAllPermissions: async () => [],
    getUserRoles: async () => [],
    assignRoleToUser: async () => undefined,
    removeRoleFromUser: async () => undefined,
    removeAllRolesFromUser: async () => undefined,
    syncUserRoles: async () => undefined,
    getUserDirectPermissions: async () => [],
    assignPermissionToUser: async () => undefined,
    removePermissionFromUser: async () => undefined,
    removeAllPermissionsFromUser: async () => undefined,
    syncUserPermissions: async () => undefined,
    getRolePermissions: async () => [],
    assignPermissionToRole: async () => undefined,
    removePermissionFromRole: async () => undefined,
    syncRolePermissions: async () => undefined,
  }
}

beforeEach(() => {
  setRbacStore(inMemoryStore())
})

describe('DEFAULT_ROLE_PACKS', () => {
  test('ships three roles: admin, dev, client', () => {
    const names = DEFAULT_ROLE_PACKS.map(p => p.name)
    expect(names).toEqual(['admin', 'dev', 'client'])
  })

  test('every pack uses the `web` guard by default (matches useRole()`s expectation)', () => {
    for (const pack of DEFAULT_ROLE_PACKS)
      expect(pack.guard_name).toBe('web')
  })

  test('every pack carries a non-empty description (sidebar tooltip / admin UI hint)', () => {
    for (const pack of DEFAULT_ROLE_PACKS)
      expect(pack.description.length).toBeGreaterThan(0)
  })
})

describe('seedDefaultRoles', () => {
  test('creates all three roles on first run', async () => {
    const result = await seedDefaultRoles()
    expect(result.created.length).toBe(3)
    expect(result.skipped.length).toBe(0)
    expect(result.created.map(r => r.name).sort()).toEqual(['admin', 'client', 'dev'])
  })

  test('idempotent: re-running creates nothing, skips everything', async () => {
    await seedDefaultRoles()
    const second = await seedDefaultRoles()
    expect(second.created.length).toBe(0)
    expect(second.skipped.length).toBe(3)
    expect(second.skipped.every(s => s.reason === 'already_exists')).toBe(true)
  })

  test('mixed: creates only the missing roles when some already exist', async () => {
    // Pre-seed just `admin` so the next call has 2 to create and 1 to skip.
    setRbacStore(inMemoryStore())
    const { createRole } = await import('../src/rbac')
    await createRole('admin', 'web', 'pre-existing')

    const result = await seedDefaultRoles()
    expect(result.created.length).toBe(2)
    expect(result.skipped.length).toBe(1)
    expect(result.skipped[0].name).toBe('admin')
    expect(result.created.map(r => r.name).sort()).toEqual(['client', 'dev'])
  })
})
