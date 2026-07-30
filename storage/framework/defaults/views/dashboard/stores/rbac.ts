import { defineStore, derived, registerStoresClient, state } from '@stacksjs/stx'
import { dashboardApi } from '../../../functions/dashboard-api'

interface RoleRow {
  id: number
  name: string
  guardName: string
  description: string | null
  createdAt: string | null
}

interface PermissionRow {
  id: number
  name: string
  guardName: string
  description: string | null
  createdAt: string | null
}

interface UserRow {
  id: number
  name: string | null
  email: string | null
}

/**
 * RBAC management store — backs the `/management/permissions` page
 * (stacksjs/stacks#1845). Loads roles, permissions, and users
 * once on page mount and keeps them in sync via the
 * `/api/dashboard/rbac/*` endpoints. All mutations follow the
 * snapshot → optimistic update → API call → rollback-on-failure
 * shape established by the kanban + ci stores earlier in the
 * session.
 *
 * The two pivot reads (user → roles, role → permissions) are
 * lazy-loaded per selection because they only matter when the
 * admin actually opens the relevant tab/row.
 */
export const rbacStore = defineStore('rbac', () => {
  const roles = state<RoleRow[]>([])
  const permissions = state<PermissionRow[]>([])
  const users = state<UserRow[]>([])

  // Per-user role memberships, keyed by user id. Lazy-loaded when
  // the admin picks a user on the Users tab so the page doesn't
  // burn N+1 round-trips just to show the user list.
  const userRoles = state<Record<string, string[]>>({})
  // Per-role permission memberships, keyed by role name (the URL
  // identifier on the matrix endpoint).
  const rolePermissions = state<Record<string, string[]>>({})

  const loading = state(true)
  const loadingPivots = state<Record<string, boolean>>({})
  const error = state<string | null>(null)

  const hasRoles = derived(() => roles().length > 0)
  const hasPermissions = derived(() => permissions().length > 0)

  function userRoleKey(userId: number, guardName: string): string {
    return `${userId}:${encodeURIComponent(guardName)}`
  }

  function rolePermissionKey(roleName: string, guardName: string): string {
    return `${encodeURIComponent(guardName)}:${encodeURIComponent(roleName)}`
  }

  function userRoleNames(userId: number, guardName: string = 'web'): string[] {
    return userRoles()[userRoleKey(userId, guardName)] ?? []
  }

  function rolePermissionNames(roleName: string, guardName: string = 'web'): string[] {
    return rolePermissions()[rolePermissionKey(roleName, guardName)] ?? []
  }

  // ─── Initial load ──────────────────────────────────────────────

  async function load(): Promise<void> {
    loading.set(true)
    error.set(null)
    try {
      const [rolesData, permsData, usersData] = await Promise.all([
        dashboardApi<{ roles?: RoleRow[], error?: string }>('/api/dashboard/rbac/roles'),
        dashboardApi<{ permissions?: PermissionRow[], error?: string }>('/api/dashboard/rbac/permissions'),
        dashboardApi<{ users?: UserRow[], error?: string }>('/api/dashboard/rbac/users'),
      ])
      // Pick the first error if any of the three failed — the page
      // renders a single banner rather than three.
      const firstError = rolesData.error || permsData.error || usersData.error
      if (firstError)
        error.set(firstError)

      roles.set(rolesData.roles ?? [])
      permissions.set(permsData.permissions ?? [])
      users.set(usersData.users ?? [])
    }
    catch (e) {
      error.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      loading.set(false)
    }
  }

  // ─── Role mutations ────────────────────────────────────────────

  async function createRole(input: { name: string, guardName?: string, description?: string }): Promise<RoleRow | null> {
    error.set(null)
    try {
      const data = await dashboardApi<{ role?: RoleRow, error?: string }>('/api/dashboard/rbac/roles', {
        method: 'POST',
        body: input,
      })
      if (data.error || !data.role) throw new Error(data.error ?? 'Create failed')
      roles.set([...roles(), data.role])
      return data.role
    }
    catch (e) {
      error.set(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  async function deleteRole(name: string, guardName: string = 'web'): Promise<boolean> {
    error.set(null)
    const snapshot = roles()
    roles.set(snapshot.filter(r => !(r.name === name && r.guardName === guardName)))
    // Cascade: a deleted role drops out of every user's role list +
    // its row in the rolePermissions cache. Mirror the server-side
    // cascade so the optimistic UI doesn't show stale attachments.
    const userRolesSnapshot = userRoles()
    const cleanedUserRoles: Record<string, string[]> = {}
    const guardSuffix = `:${encodeURIComponent(guardName)}`
    for (const [key, names] of Object.entries(userRolesSnapshot))
      cleanedUserRoles[key] = key.endsWith(guardSuffix) ? names.filter(n => n !== name) : names
    userRoles.set(cleanedUserRoles)

    const rolePermsSnapshot = rolePermissions()
    const cleanedRolePerms = { ...rolePermsSnapshot }
    delete cleanedRolePerms[rolePermissionKey(name, guardName)]
    rolePermissions.set(cleanedRolePerms)

    try {
      await dashboardApi(
        `/api/dashboard/rbac/roles/${encodeURIComponent(name)}?guard=${encodeURIComponent(guardName)}`,
        { method: 'DELETE' },
      )
      return true
    }
    catch (e) {
      // Rollback every cascade we applied optimistically.
      roles.set(snapshot)
      userRoles.set(userRolesSnapshot)
      rolePermissions.set(rolePermsSnapshot)
      error.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // ─── Permission mutations ──────────────────────────────────────

  async function createPermission(input: { name: string, guardName?: string, description?: string }): Promise<PermissionRow | null> {
    error.set(null)
    try {
      const data = await dashboardApi<{ permission?: PermissionRow, error?: string }>('/api/dashboard/rbac/permissions', {
        method: 'POST',
        body: input,
      })
      if (data.error || !data.permission) throw new Error(data.error ?? 'Create failed')
      permissions.set([...permissions(), data.permission])
      return data.permission
    }
    catch (e) {
      error.set(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  async function deletePermission(name: string, guardName: string = 'web'): Promise<boolean> {
    error.set(null)
    const snapshot = permissions()
    permissions.set(snapshot.filter(p => !(p.name === name && p.guardName === guardName)))
    // Cascade through the rolePermissions cache: each role drops the
    // deleted permission from its attached list.
    const rolePermsSnapshot = rolePermissions()
    const cleaned: Record<string, string[]> = {}
    const guardPrefix = `${encodeURIComponent(guardName)}:`
    for (const [key, names] of Object.entries(rolePermsSnapshot))
      cleaned[key] = key.startsWith(guardPrefix) ? names.filter(n => n !== name) : names
    rolePermissions.set(cleaned)

    try {
      await dashboardApi(
        `/api/dashboard/rbac/permissions/${encodeURIComponent(name)}?guard=${encodeURIComponent(guardName)}`,
        { method: 'DELETE' },
      )
      return true
    }
    catch (e) {
      permissions.set(snapshot)
      rolePermissions.set(rolePermsSnapshot)
      error.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // ─── User-role pivot ───────────────────────────────────────────

  async function loadUserRoles(userId: number, guardName: string = 'web'): Promise<void> {
    const cacheKey = userRoleKey(userId, guardName)
    if (userRoles()[cacheKey] !== undefined) return
    const loadingKey = `user:${cacheKey}`
    if (loadingPivots()[loadingKey]) return
    loadingPivots.set({ ...loadingPivots(), [loadingKey]: true })
    try {
      const data = await dashboardApi<{ roles?: Array<{ name: string }>, error?: string }>(
        `/api/dashboard/rbac/users/${userId}/roles?guard=${encodeURIComponent(guardName)}`,
      )
      if (data.error) {
        userRoles.set({ ...userRoles(), [cacheKey]: [] })
        return
      }
      userRoles.set({
        ...userRoles(),
        [cacheKey]: (data.roles ?? []).map(r => r.name),
      })
    }
    catch (e) {
      userRoles.set({ ...userRoles(), [cacheKey]: [] })
      error.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      const next = { ...loadingPivots() }
      delete next[loadingKey]
      loadingPivots.set(next)
    }
  }

  async function syncUserRoles(userId: number, roleNames: string[], guardName: string = 'web'): Promise<boolean> {
    error.set(null)
    const cacheKey = userRoleKey(userId, guardName)
    const snapshot = userRoles()[cacheKey] ?? []
    // Optimistic mutation.
    userRoles.set({ ...userRoles(), [cacheKey]: roleNames })
    try {
      const data = await dashboardApi<{ roles?: Array<{ name: string }>, error?: string }>(`/api/dashboard/rbac/users/${userId}/roles`, {
        method: 'POST',
        body: { roles: roleNames, guardName },
      })
      if (data.error) throw new Error(data.error)
      // Canonical reconciliation — server returns the final list.
      userRoles.set({
        ...userRoles(),
        [cacheKey]: (data.roles ?? []).map(r => r.name),
      })
      return true
    }
    catch (e) {
      userRoles.set({ ...userRoles(), [cacheKey]: snapshot })
      error.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // ─── Role-permission pivot ─────────────────────────────────────

  async function loadRolePermissions(roleName: string, guardName: string = 'web'): Promise<void> {
    const cacheKey = rolePermissionKey(roleName, guardName)
    if (rolePermissions()[cacheKey] !== undefined) return
    const loadingKey = `role:${cacheKey}`
    if (loadingPivots()[loadingKey]) return
    loadingPivots.set({ ...loadingPivots(), [loadingKey]: true })
    try {
      const data = await dashboardApi<{ permissions?: Array<{ name: string }>, error?: string }>(
        `/api/dashboard/rbac/roles/${encodeURIComponent(roleName)}/permissions?guard=${encodeURIComponent(guardName)}`,
      )
      if (data.error) {
        rolePermissions.set({ ...rolePermissions(), [cacheKey]: [] })
        return
      }
      rolePermissions.set({
        ...rolePermissions(),
        [cacheKey]: (data.permissions ?? []).map(p => p.name),
      })
    }
    catch (e) {
      rolePermissions.set({ ...rolePermissions(), [cacheKey]: [] })
      error.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      const next = { ...loadingPivots() }
      delete next[loadingKey]
      loadingPivots.set(next)
    }
  }

  async function syncRolePermissions(roleName: string, permissionNames: string[], guardName: string = 'web'): Promise<boolean> {
    error.set(null)
    const cacheKey = rolePermissionKey(roleName, guardName)
    const snapshot = rolePermissions()[cacheKey] ?? []
    rolePermissions.set({ ...rolePermissions(), [cacheKey]: permissionNames })
    try {
      const data = await dashboardApi<{ permissions?: Array<{ name: string }>, error?: string }>(
        `/api/dashboard/rbac/roles/${encodeURIComponent(roleName)}/permissions`,
        {
          method: 'POST',
          body: { permissions: permissionNames, guardName },
        },
      )
      if (data.error) throw new Error(data.error)
      rolePermissions.set({
        ...rolePermissions(),
        [cacheKey]: (data.permissions ?? []).map(p => p.name),
      })
      return true
    }
    catch (e) {
      rolePermissions.set({ ...rolePermissions(), [cacheKey]: snapshot })
      error.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  return {
    roles,
    permissions,
    users,
    userRoles,
    rolePermissions,
    loading,
    loadingPivots,
    error,
    hasRoles,
    hasPermissions,
    userRoleNames,
    rolePermissionNames,
    load,
    createRole,
    deleteRole,
    createPermission,
    deletePermission,
    loadUserRoles,
    syncUserRoles,
    loadRolePermissions,
    syncRolePermissions,
  }
}, {
  persist: {
    storage: 'sessionStorage',
    key: 'stacks-dashboard-rbac',
    // Don't persist the pivot caches across page reloads — they're
    // cheap to re-fetch and stale data on a sensitive admin surface
    // is worse than a 100ms refetch.
    pick: [],
  },
})

if (typeof window !== 'undefined')
  registerStoresClient({ rbacStore })
