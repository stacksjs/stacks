import type { PermissionRecord, RbacStore, RoleRecord } from '../src/rbac'
import { beforeEach, describe, expect, test } from 'bun:test'
import { RbacEntityNotFoundError, setRbacStore, syncPermissions, syncRoles } from '../src/rbac'

const roles: RoleRecord[] = [
  { id: 1, name: 'editor', guard_name: 'web' },
  { id: 2, name: 'admin', guard_name: 'web' },
  { id: 3, name: 'editor', guard_name: 'api' },
]

const permissions: PermissionRecord[] = [
  { id: 11, name: 'posts.read', guard_name: 'web' },
  { id: 12, name: 'posts.write', guard_name: 'web' },
  { id: 13, name: 'posts.read', guard_name: 'api' },
]

let assignedRoleIds: number[] = []
let assignedPermissionIds: number[] = []

function createStore(): RbacStore {
  return {
    findRoleByName: async (name, guardName = 'web') => roles.find(role => role.name === name && role.guard_name === guardName) ?? null,
    findRoleById: async id => roles.find(role => role.id === id) ?? null,
    createRole: async () => roles[0],
    deleteRole: async () => {},
    getAllRoles: async guardName => roles.filter(role => !guardName || role.guard_name === guardName),
    findPermissionByName: async (name, guardName = 'web') => permissions.find(permission => permission.name === name && permission.guard_name === guardName) ?? null,
    findPermissionById: async id => permissions.find(permission => permission.id === id) ?? null,
    createPermission: async () => permissions[0],
    deletePermission: async () => {},
    getAllPermissions: async guardName => permissions.filter(permission => !guardName || permission.guard_name === guardName),
    getUserRoles: async () => roles.filter(role => assignedRoleIds.includes(role.id)),
    assignRoleToUser: async () => {},
    removeRoleFromUser: async () => {},
    removeAllRolesFromUser: async () => {},
    syncUserRoles: async (_userId, roleIds) => {
      assignedRoleIds = [...roleIds]
    },
    getUserDirectPermissions: async () => permissions.filter(permission => assignedPermissionIds.includes(permission.id)),
    assignPermissionToUser: async () => {},
    removePermissionFromUser: async () => {},
    removeAllPermissionsFromUser: async () => {},
    syncUserPermissions: async (_userId, permissionIds) => {
      assignedPermissionIds = [...permissionIds]
    },
    getRolePermissions: async () => [],
    assignPermissionToRole: async () => {},
    removePermissionFromRole: async () => {},
    syncRolePermissions: async () => {},
  }
}

beforeEach(() => {
  assignedRoleIds = [1, 3]
  assignedPermissionIds = [11, 13]
  setRbacStore(createStore())
})

describe('guard-scoped RBAC sync', () => {
  test('syncRoles replaces the selected guard and preserves other guards', async () => {
    await syncRoles(7, ['admin', 'admin'], 'web')

    expect(assignedRoleIds).toEqual([3, 2])
  })

  test('syncPermissions replaces the selected guard and preserves other guards', async () => {
    await syncPermissions(7, ['posts.write', 'posts.write'], 'web')

    expect(assignedPermissionIds).toEqual([13, 12])
  })

  test('missing roles use a typed domain error', async () => {
    const error = await syncRoles(7, ['missing'], 'web').catch(caught => caught)

    expect(error).toBeInstanceOf(RbacEntityNotFoundError)
    expect(error).toMatchObject({ entity: 'role', value: 'missing', guardName: 'web' })
  })

  test('missing permissions use a typed domain error', async () => {
    const error = await syncPermissions(7, ['missing'], 'api').catch(caught => caught)

    expect(error).toBeInstanceOf(RbacEntityNotFoundError)
    expect(error).toMatchObject({ entity: 'permission', value: 'missing', guardName: 'api' })
  })
})
