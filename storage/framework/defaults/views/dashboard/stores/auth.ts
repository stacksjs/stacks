import { defineStore, derived, registerStoresClient, state } from '@stacksjs/stx'
import { dashboardApi } from '../../../functions/dashboard-api'

/**
 * Dashboard auth/identity store — single source of truth for "who is
 * looking at the dashboard right now and what can they see?".
 *
 * Backs the `useRole()` composable
 * (stacksjs/stacks#1843, plumbing landed for #1844). Fetches from
 * `/api/dashboard/auth/me` on first use; subsequent consumers hit the
 * cached signal.
 *
 * Auth modes the store is designed to handle:
 *
 *   1. **Local dev dashboard, no auth** — `/api/dashboard/auth/me`
 *      returns `{ user: null, roles: [], unauthenticated: true }`.
 *      We treat that as "dev mode" so dev-only surfaces (CI tracking,
 *      runner alerts, query inspector) stay visible without forcing
 *      anyone to authenticate against their own dev DB.
 *   2. **Authenticated** — the endpoint returns the real user + their
 *      RBAC role names from the `user_roles` pivot. The role-derived
 *      flags (`isAdmin`, `isDev`, `isClient`) reflect that membership.
 *   3. **Fetch failed** — network down, route 404, server error.
 *      `error` is set and role flags fail closed until a later successful
 *      refresh resolves the viewer's identity.
 */
export const authStore = defineStore('auth', () => {
  const userId = state<number | null>(null)
  const userName = state<string | null>(null)
  const userEmail = state<string | null>(null)
  const roles = state<string[]>([])
  const unauthenticated = state(false)
  const loading = state(false)
  const error = state<string | null>(null)
  const loaded = state(false)
  let pendingLoad: Promise<void> | null = null

  const isAdmin = derived(() => {
    if (!loaded()) return false
    if (unauthenticated()) return true
    return roles().includes('admin')
  })
  const isDev = derived(() => {
    if (!loaded()) return false
    if (unauthenticated()) return true
    return roles().includes('admin') || roles().includes('dev')
  })
  const isClient = derived(() => {
    if (!loaded()) return false
    if (unauthenticated()) return false
    return roles().includes('client')
  })

  async function resolveIdentity(): Promise<void> {
    loading.set(true)
    error.set(null)
    try {
      const data = await dashboardApi<{
        user: { id: number, name: string | null, email: string | null } | null
        roles: string[]
        unauthenticated?: true
      }>('/api/dashboard/auth/me')
      if (data.user) {
        userId.set(data.user.id)
        userName.set(data.user.name)
        userEmail.set(data.user.email)
      }
      else {
        userId.set(null)
        userName.set(null)
        userEmail.set(null)
      }
      roles.set(data.roles ?? [])
      unauthenticated.set(Boolean(data.unauthenticated))
      loaded.set(true)
    }
    catch (e) {
      error.set(e instanceof Error ? e.message : String(e))
      userId.set(null)
      userName.set(null)
      userEmail.set(null)
      roles.set([])
      unauthenticated.set(false)
      // Do not mark `loaded`, so a later explicit `refresh()` can retry.
    }
    finally {
      loading.set(false)
    }
  }

  function load(): Promise<void> {
    if (loaded())
      return Promise.resolve()

    if (pendingLoad)
      return pendingLoad

    pendingLoad = resolveIdentity().finally(() => {
      pendingLoad = null
    })
    return pendingLoad
  }

  async function refresh(): Promise<void> {
    if (pendingLoad)
      await pendingLoad

    loaded.set(false)
    await load()
  }

  return {
    userId,
    userName,
    userEmail,
    roles,
    unauthenticated,
    loading,
    error,
    loaded,
    isAdmin,
    isDev,
    isClient,
    load,
    refresh,
  }
}, {
  persist: {
    storage: 'sessionStorage',
    key: 'stacks-dashboard-auth',
    // Don't persist authorization state. Every fresh tab re-fetches identity
    // (the user may have been assigned a new role, or signed out, since
    // the last visit). User info remains a display-only soft cache.
    pick: ['userId', 'userName', 'userEmail'],
  },
})

if (typeof window !== 'undefined')
  registerStoresClient({ authStore })
