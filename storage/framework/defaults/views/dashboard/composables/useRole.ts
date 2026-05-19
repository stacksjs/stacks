/**
 * Role-aware visibility hook for dashboard features.
 *
 * Backs gating decisions across the dashboard
 * (stacksjs/stacks#1843, first consumer: CI tracking in #1844).
 *
 * Resolution chain (in order):
 *
 *   1. **Authenticated user with roles** — Reads the role names returned
 *      by `/api/dashboard/auth/me` (Action: `Dashboard/Auth/MeAction` →
 *      `@stacksjs/auth` → `BqbRbacStore` → `user_roles` pivot). Role
 *      membership is the authoritative answer.
 *   2. **Authenticated user with no role records** — The user exists but
 *      has nothing in `user_roles`. Treated as `client` (most restrictive)
 *      so a brand-new account doesn't accidentally see dev tools before
 *      an admin assigns a role.
 *   3. **Unauthenticated** — No bearer token, no session. The dev
 *      dashboard on localhost lands here. Defaults to `isDev: true` so
 *      the surface stays usable without forcing anyone to log in against
 *      a local DB. Production deployments that gate `/api/dashboard/*`
 *      behind the `auth` middleware never hit this branch — the endpoint
 *      returns a real user/roles and case (1) applies.
 *
 * Consumers should `derived(() => isDev())` so the signal flips
 * reactively if the user's roles change (admin assigns/revokes via the
 * RBAC UI without a page reload).
 */
import { useStore } from '@stacksjs/stx'

export interface RoleSnapshot {
  /** Admin: every dashboard surface is visible. */
  isAdmin: () => boolean
  /** Dev: infra/dev-mode surfaces (CI tracking, runner alerts, queries). */
  isDev: () => boolean
  /** Client: minimal surface — content / orders / billing only. */
  isClient: () => boolean
  /** Trigger the identity round-trip. Safe to call repeatedly; the store
   * dedupes in-flight + cached responses. */
  load: () => Promise<void>
  /** Force a re-fetch (e.g. after an admin assigns the viewer a new role). */
  refresh: () => Promise<void>
}

export function useRole(): RoleSnapshot {
  const auth = useStore('auth')

  // Fire the load lazily on first consumer. The store guards against
  // double-fetch so multiple `useRole()` calls in one page are safe.
  auth.load()

  return {
    isAdmin: () => auth.isAdmin(),
    isDev: () => auth.isDev(),
    isClient: () => auth.isClient(),
    load: () => auth.load(),
    refresh: () => auth.refresh(),
  }
}
