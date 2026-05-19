import { defineStore, derived, registerStoresClient, state } from '@stacksjs/stx'

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
 *      `error` is set, but the role flags still default to "permissive
 *      dev" so a broken endpoint doesn't lock the dashboard.
 */
export const authStore = defineStore('auth', () => {
  const userId = state<number | null>(null)
  const userName = state<string | null>(null)
  const userEmail = state<string | null>(null)
  const roles = state<string[]>([])
  const unauthenticated = state(true)
  const loading = state(false)
  const error = state<string | null>(null)
  const loaded = state(false)

  // Permissive-dev defaults: when nobody is signed in (or the endpoint
  // failed), assume the viewer is a dev. The alternative — hiding every
  // gated surface until auth is wired — would make the dashboard look
  // broken on a fresh project.
  const isAdmin = derived(() => {
    if (unauthenticated()) return true
    return roles().includes('admin')
  })
  const isDev = derived(() => {
    if (unauthenticated()) return true
    return roles().includes('admin') || roles().includes('dev')
  })
  const isClient = derived(() => {
    if (unauthenticated()) return false
    return roles().includes('client')
  })

  async function load(): Promise<void> {
    if (loading() || loaded()) return
    loading.set(true)
    error.set(null)
    try {
      const res = await fetch('/api/dashboard/auth/me', { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        user: { id: number, name: string | null, email: string | null } | null
        roles: string[]
        unauthenticated?: true
      }
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
      // Keep the permissive defaults: don't mark `loaded` so a later
      // explicit `refresh()` can retry.
    }
    finally {
      loading.set(false)
    }
  }

  async function refresh(): Promise<void> {
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
    // Don't persist `loaded` — every fresh tab should re-fetch identity
    // (the user may have been assigned a new role, or signed out, since
    // the last visit). Roles + user info ride along as a soft cache so
    // the dashboard renders against last-known state before the
    // round-trip resolves.
    pick: ['userId', 'userName', 'userEmail', 'roles', 'unauthenticated'],
  },
})

if (typeof window !== 'undefined')
  registerStoresClient({ authStore })
