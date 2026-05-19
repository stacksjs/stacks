import { defineStore, derived, registerStoresClient, state } from '@stacksjs/stx'

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
  const userRoles = state<Record<number, string[]>>({})
  // Per-role permission memberships, keyed by role name (the URL
  // identifier on the matrix endpoint).
  const rolePermissions = state<Record<string, string[]>>({})

  const loading = state(true)
  const loadingPivots = state<Record<string, boolean>>({})
  const error = state<string | null>(null)

  const hasRoles = derived(() => roles().length > 0)
  const hasPermissions = derived(() => permissions().length > 0)

  // ─── Initial load ──────────────────────────────────────────────

  async function load(): Promise<void> {
    loading.set(true)
    error.set(null)
    try {
      const [rolesRes, permsRes, usersRes] = await Promise.all([
        fetch('/api/dashboard/rbac/roles', { headers: { accept: 'application/json' } }),
        fetch('/api/dashboard/rbac/permissions', { headers: { accept: 'application/json' } }),
        fetch('/api/dashboard/rbac/users', { headers: { accept: 'application/json' } }),
      ])
      const [rolesData, permsData, usersData] = await Promise.all([
        rolesRes.json() as Promise<{ roles?: RoleRow[], error?: string }>,
        permsRes.json() as Promise<{ permissions?: PermissionRow[], error?: string }>,
        usersRes.json() as Promise<{ users?: UserRow[], error?: string }>,
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
    try {
      const res = await fetch('/api/dashboard/rbac/roles', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { role?: RoleRow, error?: string }
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
    const snapshot = roles()
    roles.set(snapshot.filter(r => !(r.name === name && r.guardName === guardName)))
    // Cascade: a deleted role drops out of every user's role list +
    // its row in the rolePermissions cache. Mirror the server-side
    // cascade so the optimistic UI doesn't show stale attachments.
    const userRolesSnapshot = userRoles()
    const cleanedUserRoles: Record<number, string[]> = {}
    for (const [uid, names] of Object.entries(userRolesSnapshot))
      cleanedUserRoles[Number(uid)] = names.filter(n => n !== name)
    userRoles.set(cleanedUserRoles)

    const rolePermsSnapshot = rolePermissions()
    const cleanedRolePerms = { ...rolePermsSnapshot }
    delete cleanedRolePerms[name]
    rolePermissions.set(cleanedRolePerms)

    try {
      const res = await fetch(
        `/api/dashboard/rbac/roles/${encodeURIComponent(name)}?guard=${encodeURIComponent(guardName)}`,
        { method: 'DELETE', headers: { accept: 'application/json' } },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
    try {
      const res = await fetch('/api/dashboard/rbac/permissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok && res.status !== 409) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { permission?: PermissionRow, error?: string }
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
    const snapshot = permissions()
    permissions.set(snapshot.filter(p => !(p.name === name && p.guardName === guardName)))
    // Cascade through the rolePermissions cache: each role drops the
    // deleted permission from its attached list.
    const rolePermsSnapshot = rolePermissions()
    const cleaned: Record<string, string[]> = {}
    for (const [roleName, names] of Object.entries(rolePermsSnapshot))
      cleaned[roleName] = names.filter(n => n !== name)
    rolePermissions.set(cleaned)

    try {
      const res = await fetch(
        `/api/dashboard/rbac/permissions/${encodeURIComponent(name)}?guard=${encodeURIComponent(guardName)}`,
        { method: 'DELETE', headers: { accept: 'application/json' } },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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

  async function loadUserRoles(userId: number): Promise<void> {
    if (userRoles()[userId] !== undefined) return
    const key = `user:${userId}`
    if (loadingPivots()[key]) return
    loadingPivots.set({ ...loadingPivots(), [key]: true })
    try {
      const res = await fetch(`/api/dashboard/rbac/users/${userId}/roles`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { roles?: Array<{ name: string }>, error?: string }
      if (data.error) {
        userRoles.set({ ...userRoles(), [userId]: [] })
        return
      }
      userRoles.set({
        ...userRoles(),
        [userId]: (data.roles ?? []).map(r => r.name),
      })
    }
    catch {
      // Soft-fail — page shows an empty role list for the user.
      userRoles.set({ ...userRoles(), [userId]: [] })
    }
    finally {
      const next = { ...loadingPivots() }
      delete next[key]
      loadingPivots.set(next)
    }
  }

  async function syncUserRoles(userId: number, roleNames: string[], guardName: string = 'web'): Promise<boolean> {
    const snapshot = userRoles()[userId] ?? []
    // Optimistic mutation.
    userRoles.set({ ...userRoles(), [userId]: roleNames })
    try {
      const res = await fetch(`/api/dashboard/rbac/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ roles: roleNames, guardName }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { roles?: Array<{ name: string }>, error?: string }
      if (data.error) throw new Error(data.error)
      // Canonical reconciliation — server returns the final list.
      userRoles.set({
        ...userRoles(),
        [userId]: (data.roles ?? []).map(r => r.name),
      })
      return true
    }
    catch (e) {
      userRoles.set({ ...userRoles(), [userId]: snapshot })
      error.set(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  // ─── Role-permission pivot ─────────────────────────────────────

  async function loadRolePermissions(roleName: string, guardName: string = 'web'): Promise<void> {
    if (rolePermissions()[roleName] !== undefined) return
    const key = `role:${roleName}`
    if (loadingPivots()[key]) return
    loadingPivots.set({ ...loadingPivots(), [key]: true })
    try {
      const res = await fetch(
        `/api/dashboard/rbac/roles/${encodeURIComponent(roleName)}/permissions?guard=${encodeURIComponent(guardName)}`,
        { headers: { accept: 'application/json' } },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { permissions?: Array<{ name: string }>, error?: string }
      if (data.error) {
        rolePermissions.set({ ...rolePermissions(), [roleName]: [] })
        return
      }
      rolePermissions.set({
        ...rolePermissions(),
        [roleName]: (data.permissions ?? []).map(p => p.name),
      })
    }
    catch {
      rolePermissions.set({ ...rolePermissions(), [roleName]: [] })
    }
    finally {
      const next = { ...loadingPivots() }
      delete next[key]
      loadingPivots.set(next)
    }
  }

  async function syncRolePermissions(roleName: string, permissionNames: string[], guardName: string = 'web'): Promise<boolean> {
    const snapshot = rolePermissions()[roleName] ?? []
    rolePermissions.set({ ...rolePermissions(), [roleName]: permissionNames })
    try {
      const res = await fetch(
        `/api/dashboard/rbac/roles/${encodeURIComponent(roleName)}/permissions`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ permissions: permissionNames, guardName }),
        },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { permissions?: Array<{ name: string }>, error?: string }
      if (data.error) throw new Error(data.error)
      rolePermissions.set({
        ...rolePermissions(),
        [roleName]: (data.permissions ?? []).map(p => p.name),
      })
      return true
    }
    catch (e) {
      rolePermissions.set({ ...rolePermissions(), [roleName]: snapshot })
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
