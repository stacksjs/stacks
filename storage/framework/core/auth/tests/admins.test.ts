/**
 * `config.auth.admins` provisioning. The RBAC store and the account store
 * are both in memory, so this covers the rules (normalization, idempotence,
 * grants only, `role: false`, `afterEach`) without a database.
 */

import type { RbacStore } from '../src/rbac'
import { beforeEach, describe, expect, test } from 'bun:test'
import { adminEmails, nameFromEmail, provisionAdmins } from '../src/admins'
import { flushRbacCache, setRbacStore } from '../src/rbac'

let roles: Array<{ id: number, name: string, guard_name: string }>
let assigned: Map<number, Set<number>>

function inMemoryRbac(): RbacStore {
  const none = async () => undefined
  return {
    findRoleByName: async (name, guard = 'web') => roles.find(role => role.name === name && role.guard_name === guard) ?? null,
    findRoleById: async id => roles.find(role => role.id === id) ?? null,
    createRole: async (name, guard = 'web') => {
      const role = { id: roles.length + 1, name, guard_name: guard }
      roles.push(role)
      return role as any
    },
    deleteRole: none,
    getAllRoles: async () => roles as any,
    findPermissionByName: async () => null,
    findPermissionById: async () => null,
    createPermission: async () => ({ id: 0, name: '', guard_name: '' } as any),
    deletePermission: none,
    getAllPermissions: async () => [],
    getUserRoles: async userId => roles.filter(role => assigned.get(userId)?.has(role.id)) as any,
    assignRoleToUser: async (userId, roleId) => { assigned.set(userId, (assigned.get(userId) ?? new Set()).add(roleId)) },
    removeRoleFromUser: none,
    removeAllRolesFromUser: none,
    syncUserRoles: none,
    getUserDirectPermissions: async () => [],
    assignPermissionToUser: none,
    removePermissionFromUser: none,
    removeAllPermissionsFromUser: none,
    syncUserPermissions: none,
    getRolePermissions: async () => [],
    assignPermissionToRole: none,
    removePermissionFromRole: none,
    syncRolePermissions: none,
  }
}

let users: Array<{ id: number, email: string, name: string }>
const accounts = {
  findUserId: async (email: string) => users.find(user => user.email === email)?.id ?? null,
  createUser: async ({ email, name }: { email: string, name: string }) => {
    users.push({ id: users.length + 1, email, name })
    return users.length
  },
}

beforeEach(() => {
  roles = []
  assigned = new Map()
  users = [{ id: 1, email: 'existing@example.com', name: 'Existing' }]
  setRbacStore(inMemoryRbac())
  flushRbacCache()
})

describe('adminEmails', () => {
  test('normalizes and keeps order', () => {
    expect(adminEmails([' Ops@Example.com ', 'founder@example.com'])).toEqual(['ops@example.com', 'founder@example.com'])
  })

  test('an unset list is empty', () => {
    expect(adminEmails(undefined)).toEqual([])
  })

  test('a typo or a repeat fails loudly instead of granting nothing', () => {
    expect(() => adminEmails(['ops@example'])).toThrow('invalid email')
    expect(() => adminEmails(['a@example.com', 'A@example.com'])).toThrow('twice')
    expect(() => adminEmails('ops@example.com')).toThrow('list')
  })
})

test('nameFromEmail reads a name out of the local part', () => {
  expect(nameFromEmail('ada.lovelace@example.com')).toBe('Ada Lovelace')
  expect(nameFromEmail('pawel+lsu@example.com')).toBe('Pawel')
})

describe('provisionAdmins', () => {
  test('creates missing accounts, grants the role, and creates the role row', async () => {
    const result = await provisionAdmins({ emails: ['existing@example.com', 'new.person@example.com'], role: { name: 'admin' }, accounts })
    expect(result).toEqual([
      { email: 'existing@example.com', userId: 1, outcome: 'granted' },
      { email: 'new.person@example.com', userId: 2, outcome: 'created' },
    ])
    expect(users[1]!.name).toBe('New Person')
    expect(roles).toEqual([{ id: 1, name: 'admin', guard_name: 'web' }])
    expect([...assigned.get(1)!]).toEqual([1])
    expect([...assigned.get(2)!]).toEqual([1])
  })

  test('a second run changes nothing', async () => {
    const options = { emails: ['existing@example.com', 'new@example.com'], role: { name: 'admin' }, accounts }
    await provisionAdmins(options)
    const again = await provisionAdmins(options)
    expect(again.map(admin => admin.outcome)).toEqual(['unchanged', 'unchanged'])
    expect(users).toHaveLength(2)
    expect(roles).toHaveLength(1)
  })

  test('role: false provisions accounts only, and afterEach reports its own change', async () => {
    const seen: unknown[] = []
    const result = await provisionAdmins({
      emails: ['existing@example.com', 'new@example.com'],
      role: false,
      accounts,
      afterEach: async (admin) => { seen.push(admin); return admin.email === 'existing@example.com' },
    })
    expect(roles).toEqual([])
    expect(seen).toEqual([{ userId: 1, email: 'existing@example.com', created: false }, { userId: 2, email: 'new@example.com', created: true }])
    expect(result.map(admin => admin.outcome)).toEqual(['granted', 'created'])
  })

  test('an empty list touches nothing', async () => {
    expect(await provisionAdmins({ emails: [], accounts })).toEqual([])
    expect(roles).toEqual([])
  })
})
