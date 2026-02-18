/**
 * Role-Based Access Control (RBAC)
 *
 * Provides a complete RBAC system with roles, permissions,
 * and helper functions for checking user access.
 *
 * @example
 * import { hasRole, hasPermission, assignRole } from '@stacksjs/auth'
 *
 * if (await hasRole(user, 'admin')) { ... }
 * await assignRole(userId, 'editor')
 */


type UserModel = typeof User

export interface RoleRecord {
  id: number
  name: string
  guard_name: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface PermissionRecord {
  id: number
  name: string
  guard_name: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface RolePermissionPivot {
  role_id: number
  permission_id: number
  created_at?: string
}

export interface UserRolePivot {
  user_id: number
  role_id: number
  created_at?: string
}

export interface UserPermissionPivot {
  user_id: number
  permission_id: number
  created_at?: string
}

/**
 * In-memory role/permission cache for performance.
 * Call `flushRbacCache()` after modifying roles/permissions.
 */
const cache = {
  userRoles: new Map<number, RoleRecord[]>(),
  userPermissions: new Map<number, PermissionRecord[]>(),
  rolePermissions: new Map<number, PermissionRecord[]>(),
  roles: new Map<string, RoleRecord>(),
  permissions: new Map<string, PermissionRecord>(),
}

/**
 * RBAC database adapter interface.
 * Implement this to connect RBAC to your database layer.
 */
export interface RbacStore {
  // Role operations
  findRoleByName(name: string, guardName?: string): Promise<RoleRecord | null>
  findRoleById(id: number): Promise<RoleRecord | null>
  createRole(name: string, guardName?: string, description?: string): Promise<RoleRecord>
  deleteRole(id: number): Promise<void>
  getAllRoles(guardName?: string): Promise<RoleRecord[]>

  // Permission operations
  findPermissionByName(name: string, guardName?: string): Promise<PermissionRecord | null>
  findPermissionById(id: number): Promise<PermissionRecord | null>
  createPermission(name: string, guardName?: string, description?: string): Promise<PermissionRecord>
  deletePermission(id: number): Promise<void>
  getAllPermissions(guardName?: string): Promise<PermissionRecord[]>

  // User-Role operations
  getUserRoles(userId: number): Promise<RoleRecord[]>
  assignRoleToUser(userId: number, roleId: number): Promise<void>
  removeRoleFromUser(userId: number, roleId: number): Promise<void>
  removeAllRolesFromUser(userId: number): Promise<void>
  syncUserRoles(userId: number, roleIds: number[]): Promise<void>

  // User-Permission operations (direct)
  getUserDirectPermissions(userId: number): Promise<PermissionRecord[]>
  assignPermissionToUser(userId: number, permissionId: number): Promise<void>
  removePermissionFromUser(userId: number, permissionId: number): Promise<void>
  removeAllPermissionsFromUser(userId: number): Promise<void>
  syncUserPermissions(userId: number, permissionIds: number[]): Promise<void>

  // Role-Permission operations
  getRolePermissions(roleId: number): Promise<PermissionRecord[]>
  assignPermissionToRole(roleId: number, permissionId: number): Promise<void>
  removePermissionFromRole(roleId: number, permissionId: number): Promise<void>
  syncRolePermissions(roleId: number, permissionIds: number[]): Promise<void>
}

let store: RbacStore | null = null

/**
 * Set the RBAC store implementation
 */
export function setRbacStore(rbacStore: RbacStore): void {
  store = rbacStore
  flushRbacCache()
}

/**
 * Get the current RBAC store
 */
function getStore(): RbacStore {
  if (!store) {
    throw new Error('RBAC store not configured. Call setRbacStore() first.')
  }
  return store
}

/**
 * Flush the RBAC cache
 */
export function flushRbacCache(): void {
  cache.userRoles.clear()
  cache.userPermissions.clear()
  cache.rolePermissions.clear()
  cache.roles.clear()
  cache.permissions.clear()
}

// ─── Helper to get user ID ─────────────────────────────────────

function getUserId(user: UserModel | { id: number } | number): number {
  if (typeof user === 'number') return user
  return (user as any).id
}

// ─── Role Management ────────────────────────────────────────────

/**
 * Create a new role
 */
export async function createRole(name: string, guardName: string = 'web', description?: string): Promise<RoleRecord> {
  const role = await getStore().createRole(name, guardName, description)
  cache.roles.set(`${name}:${guardName}`, role)
  return role
}

/**
 * Find a role by name
 */
export async function findRole(name: string, guardName: string = 'web'): Promise<RoleRecord | null> {
  const cacheKey = `${name}:${guardName}`
  if (cache.roles.has(cacheKey)) return cache.roles.get(cacheKey)!

  const role = await getStore().findRoleByName(name, guardName)
  if (role) cache.roles.set(cacheKey, role)
  return role
}

/**
 * Delete a role
 */
export async function deleteRole(name: string, guardName: string = 'web'): Promise<void> {
  const role = await findRole(name, guardName)
  if (role) {
    await getStore().deleteRole(role.id)
    cache.roles.delete(`${name}:${guardName}`)
    flushRbacCache()
  }
}

/**
 * Get all roles
 */
export async function getAllRoles(guardName?: string): Promise<RoleRecord[]> {
  return getStore().getAllRoles(guardName)
}

// ─── Permission Management ──────────────────────────────────────

/**
 * Create a new permission
 */
export async function createPermission(name: string, guardName: string = 'web', description?: string): Promise<PermissionRecord> {
  const permission = await getStore().createPermission(name, guardName, description)
  cache.permissions.set(`${name}:${guardName}`, permission)
  return permission
}

/**
 * Find a permission by name
 */
export async function findPermission(name: string, guardName: string = 'web'): Promise<PermissionRecord | null> {
  const cacheKey = `${name}:${guardName}`
  if (cache.permissions.has(cacheKey)) return cache.permissions.get(cacheKey)!

  const permission = await getStore().findPermissionByName(name, guardName)
  if (permission) cache.permissions.set(cacheKey, permission)
  return permission
}

/**
 * Delete a permission
 */
export async function deletePermission(name: string, guardName: string = 'web'): Promise<void> {
  const permission = await findPermission(name, guardName)
  if (permission) {
    await getStore().deletePermission(permission.id)
    cache.permissions.delete(`${name}:${guardName}`)
    flushRbacCache()
  }
}

/**
 * Get all permissions
 */
export async function getAllPermissions(guardName?: string): Promise<PermissionRecord[]> {
  return getStore().getAllPermissions(guardName)
}

// ─── User-Role Operations ───────────────────────────────────────

/**
 * Get all roles for a user
 */
export async function getUserRoles(user: UserModel | { id: number } | number): Promise<RoleRecord[]> {
  const userId = getUserId(user)

  if (cache.userRoles.has(userId)) return cache.userRoles.get(userId)!

  const roles = await getStore().getUserRoles(userId)
  cache.userRoles.set(userId, roles)
  return roles
}

/**
 * Assign a role to a user
 */
export async function assignRole(user: UserModel | { id: number } | number, roleName: string, guardName: string = 'web'): Promise<void> {
  const userId = getUserId(user)
  const role = await findRole(roleName, guardName)
  if (!role) throw new Error(`Role '${roleName}' not found.`)

  await getStore().assignRoleToUser(userId, role.id)
  cache.userRoles.delete(userId)
  cache.userPermissions.delete(userId)
}

/**
 * Remove a role from a user
 */
export async function removeRole(user: UserModel | { id: number } | number, roleName: string, guardName: string = 'web'): Promise<void> {
  const userId = getUserId(user)
  const role = await findRole(roleName, guardName)
  if (!role) return

  await getStore().removeRoleFromUser(userId, role.id)
  cache.userRoles.delete(userId)
  cache.userPermissions.delete(userId)
}

/**
 * Remove all roles from a user
 */
export async function removeAllRoles(user: UserModel | { id: number } | number): Promise<void> {
  const userId = getUserId(user)
  await getStore().removeAllRolesFromUser(userId)
  cache.userRoles.delete(userId)
  cache.userPermissions.delete(userId)
}

/**
 * Sync roles for a user (replaces all current roles)
 */
export async function syncRoles(user: UserModel | { id: number } | number, roleNames: string[], guardName: string = 'web'): Promise<void> {
  const userId = getUserId(user)
  const roleIds: number[] = []

  for (const name of roleNames) {
    const role = await findRole(name, guardName)
    if (!role) throw new Error(`Role '${name}' not found.`)
    roleIds.push(role.id)
  }

  await getStore().syncUserRoles(userId, roleIds)
  cache.userRoles.delete(userId)
  cache.userPermissions.delete(userId)
}

/**
 * Check if a user has a specific role
 */
export async function hasRole(user: UserModel | { id: number } | number, roleName: string, guardName: string = 'web'): Promise<boolean> {
  const roles = await getUserRoles(user)
  return roles.some(r => r.name === roleName && r.guard_name === guardName)
}

/**
 * Check if a user has any of the given roles
 */
export async function hasAnyRole(user: UserModel | { id: number } | number, roleNames: string[], guardName: string = 'web'): Promise<boolean> {
  const roles = await getUserRoles(user)
  return roleNames.some(name => roles.some(r => r.name === name && r.guard_name === guardName))
}

/**
 * Check if a user has all of the given roles
 */
export async function hasAllRoles(user: UserModel | { id: number } | number, roleNames: string[], guardName: string = 'web'): Promise<boolean> {
  const roles = await getUserRoles(user)
  return roleNames.every(name => roles.some(r => r.name === name && r.guard_name === guardName))
}

// ─── User-Permission Operations ─────────────────────────────────

/**
 * Get all permissions for a user (direct + via roles)
 */
export async function getUserPermissions(user: UserModel | { id: number } | number): Promise<PermissionRecord[]> {
  const userId = getUserId(user)

  if (cache.userPermissions.has(userId)) return cache.userPermissions.get(userId)!

  const directPermissions = await getStore().getUserDirectPermissions(userId)
  const roles = await getUserRoles(user)

  const rolePermissions: PermissionRecord[] = []
  for (const role of roles) {
    const perms = await getRolePermissions(role.id)
    rolePermissions.push(...perms)
  }

  // Deduplicate by permission id
  const seen = new Set<number>()
  const allPermissions: PermissionRecord[] = []

  for (const perm of [...directPermissions, ...rolePermissions]) {
    if (!seen.has(perm.id)) {
      seen.add(perm.id)
      allPermissions.push(perm)
    }
  }

  cache.userPermissions.set(userId, allPermissions)
  return allPermissions
}

/**
 * Give a direct permission to a user
 */
export async function givePermission(user: UserModel | { id: number } | number, permissionName: string, guardName: string = 'web'): Promise<void> {
  const userId = getUserId(user)
  const permission = await findPermission(permissionName, guardName)
  if (!permission) throw new Error(`Permission '${permissionName}' not found.`)

  await getStore().assignPermissionToUser(userId, permission.id)
  cache.userPermissions.delete(userId)
}

/**
 * Revoke a direct permission from a user
 */
export async function revokePermission(user: UserModel | { id: number } | number, permissionName: string, guardName: string = 'web'): Promise<void> {
  const userId = getUserId(user)
  const permission = await findPermission(permissionName, guardName)
  if (!permission) return

  await getStore().removePermissionFromUser(userId, permission.id)
  cache.userPermissions.delete(userId)
}

/**
 * Revoke all direct permissions from a user
 */
export async function revokeAllPermissions(user: UserModel | { id: number } | number): Promise<void> {
  const userId = getUserId(user)
  await getStore().removeAllPermissionsFromUser(userId)
  cache.userPermissions.delete(userId)
}

/**
 * Sync direct permissions for a user
 */
export async function syncPermissions(user: UserModel | { id: number } | number, permissionNames: string[], guardName: string = 'web'): Promise<void> {
  const userId = getUserId(user)
  const permissionIds: number[] = []

  for (const name of permissionNames) {
    const perm = await findPermission(name, guardName)
    if (!perm) throw new Error(`Permission '${name}' not found.`)
    permissionIds.push(perm.id)
  }

  await getStore().syncUserPermissions(userId, permissionIds)
  cache.userPermissions.delete(userId)
}

/**
 * Check if a user has a specific permission (direct or via role)
 */
export async function hasPermission(user: UserModel | { id: number } | number, permissionName: string, guardName: string = 'web'): Promise<boolean> {
  const permissions = await getUserPermissions(user)
  return permissions.some(p => p.name === permissionName && p.guard_name === guardName)
}

/**
 * Check if a user has any of the given permissions
 */
export async function hasAnyPermission(user: UserModel | { id: number } | number, permissionNames: string[], guardName: string = 'web'): Promise<boolean> {
  const permissions = await getUserPermissions(user)
  return permissionNames.some(name => permissions.some(p => p.name === name && p.guard_name === guardName))
}

/**
 * Check if a user has all of the given permissions
 */
export async function hasAllPermissions(user: UserModel | { id: number } | number, permissionNames: string[], guardName: string = 'web'): Promise<boolean> {
  const permissions = await getUserPermissions(user)
  return permissionNames.every(name => permissions.some(p => p.name === name && p.guard_name === guardName))
}

// ─── Role-Permission Operations ─────────────────────────────────

/**
 * Get all permissions for a role
 */
export async function getRolePermissions(roleId: number): Promise<PermissionRecord[]> {
  if (cache.rolePermissions.has(roleId)) return cache.rolePermissions.get(roleId)!

  const permissions = await getStore().getRolePermissions(roleId)
  cache.rolePermissions.set(roleId, permissions)
  return permissions
}

/**
 * Assign a permission to a role
 */
export async function givePermissionToRole(roleName: string, permissionName: string, guardName: string = 'web'): Promise<void> {
  const role = await findRole(roleName, guardName)
  if (!role) throw new Error(`Role '${roleName}' not found.`)

  const permission = await findPermission(permissionName, guardName)
  if (!permission) throw new Error(`Permission '${permissionName}' not found.`)

  await getStore().assignPermissionToRole(role.id, permission.id)
  cache.rolePermissions.delete(role.id)
  // Flush user permission cache since role permissions changed
  cache.userPermissions.clear()
}

/**
 * Remove a permission from a role
 */
export async function revokePermissionFromRole(roleName: string, permissionName: string, guardName: string = 'web'): Promise<void> {
  const role = await findRole(roleName, guardName)
  if (!role) return

  const permission = await findPermission(permissionName, guardName)
  if (!permission) return

  await getStore().removePermissionFromRole(role.id, permission.id)
  cache.rolePermissions.delete(role.id)
  cache.userPermissions.clear()
}

/**
 * Sync permissions for a role
 */
export async function syncRolePermissions(roleName: string, permissionNames: string[], guardName: string = 'web'): Promise<void> {
  const role = await findRole(roleName, guardName)
  if (!role) throw new Error(`Role '${roleName}' not found.`)

  const permissionIds: number[] = []
  for (const name of permissionNames) {
    const perm = await findPermission(name, guardName)
    if (!perm) throw new Error(`Permission '${name}' not found.`)
    permissionIds.push(perm.id)
  }

  await getStore().syncRolePermissions(role.id, permissionIds)
  cache.rolePermissions.delete(role.id)
  cache.userPermissions.clear()
}

// ─── Authorizable Mixin (add to user objects) ───────────────────

export interface RbacMethods {
  hasRole(roleName: string, guardName?: string): Promise<boolean>
  hasAnyRole(roleNames: string[], guardName?: string): Promise<boolean>
  hasAllRoles(roleNames: string[], guardName?: string): Promise<boolean>
  hasPermission(permissionName: string, guardName?: string): Promise<boolean>
  hasAnyPermission(permissionNames: string[], guardName?: string): Promise<boolean>
  hasAllPermissions(permissionNames: string[], guardName?: string): Promise<boolean>
  getRoles(): Promise<RoleRecord[]>
  getPermissions(): Promise<PermissionRecord[]>
  assignRole(roleName: string, guardName?: string): Promise<void>
  removeRole(roleName: string, guardName?: string): Promise<void>
  syncRoles(roleNames: string[], guardName?: string): Promise<void>
  givePermission(permissionName: string, guardName?: string): Promise<void>
  revokePermission(permissionName: string, guardName?: string): Promise<void>
  syncPermissions(permissionNames: string[], guardName?: string): Promise<void>
}

/**
 * Add RBAC methods to a user object
 *
 * @example
 * const user = withRbac(authenticatedUser)
 * if (await user.hasRole('admin')) { ... }
 * await user.assignRole('editor')
 */
export function withRbac<T extends UserModel | { id: number }>(user: T): T & RbacMethods {
  const userId = getUserId(user)

  return Object.assign(user, {
    hasRole: (roleName: string, guardName?: string) => hasRole(userId, roleName, guardName),
    hasAnyRole: (roleNames: string[], guardName?: string) => hasAnyRole(userId, roleNames, guardName),
    hasAllRoles: (roleNames: string[], guardName?: string) => hasAllRoles(userId, roleNames, guardName),
    hasPermission: (permissionName: string, guardName?: string) => hasPermission(userId, permissionName, guardName),
    hasAnyPermission: (permissionNames: string[], guardName?: string) => hasAnyPermission(userId, permissionNames, guardName),
    hasAllPermissions: (permissionNames: string[], guardName?: string) => hasAllPermissions(userId, permissionNames, guardName),
    getRoles: () => getUserRoles(userId),
    getPermissions: () => getUserPermissions(userId),
    assignRole: (roleName: string, guardName?: string) => assignRole(userId, roleName, guardName),
    removeRole: (roleName: string, guardName?: string) => removeRole(userId, roleName, guardName),
    syncRoles: (roleNames: string[], guardName?: string) => syncRoles(userId, roleNames, guardName),
    givePermission: (permissionName: string, guardName?: string) => givePermission(userId, permissionName, guardName),
    revokePermission: (permissionName: string, guardName?: string) => revokePermission(userId, permissionName, guardName),
    syncPermissions: (permissionNames: string[], guardName?: string) => syncPermissions(userId, permissionNames, guardName),
  })
}

/**
 * RBAC facade for convenient access
 */
export const Rbac = {
  // Store
  setStore: setRbacStore,
  flushCache: flushRbacCache,

  // Role management
  createRole,
  findRole,
  deleteRole,
  getAllRoles,

  // Permission management
  createPermission,
  findPermission,
  deletePermission,
  getAllPermissions,

  // User-Role
  getUserRoles,
  assignRole,
  removeRole,
  removeAllRoles,
  syncRoles,
  hasRole,
  hasAnyRole,
  hasAllRoles,

  // User-Permission
  getUserPermissions,
  givePermission,
  revokePermission,
  revokeAllPermissions,
  syncPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,

  // Role-Permission
  getRolePermissions,
  givePermissionToRole,
  revokePermissionFromRole,
  syncRolePermissions,

  // Mixin
  withRbac,
}

export default Rbac
