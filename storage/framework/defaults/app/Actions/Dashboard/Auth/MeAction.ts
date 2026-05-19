import { Action } from '@stacksjs/actions'
import { getUserRoles } from '@stacksjs/auth'

interface MeResponse {
  user: {
    id: number
    name: string | null
    email: string | null
  } | null
  roles: string[]
  /**
   * Permissive defaults for the un-authenticated case (e.g. the dev dashboard
   * on localhost where no bearer token is required). Surfaces are role-gated
   * via `useRole()` which falls back to these when `user` is null, so the
   * dashboard remains usable without auth.
   */
  unauthenticated?: true
}

/**
 * `GET /api/dashboard/auth/me`
 *
 * Returns the currently-authenticated user plus the names of every role
 * they hold. Powers the dashboard's `useRole()` composable
 * ([stacksjs/stacks#1843](https://github.com/stacksjs/stacks/issues/1843))
 * which gates dev-mode surfaces like CI tracking (#1844) and (eventually)
 * client-mode hiding of infra surfaces.
 *
 * Auth model: this endpoint is intentionally **not** behind the `auth`
 * middleware. The dashboard runs locally for `buddy dev --dashboard` with
 * no bearer token at all, and we don't want every dashboard load to flash
 * a 401 in the network tab. Instead:
 *
 *   - If the request carries a valid bearer token, the framework's auth
 *     middleware already populated `request.user` — we return that user
 *     plus their roles.
 *   - If not, we return `{ user: null, roles: [], unauthenticated: true }`.
 *     The composable's "no auth → assume dev" default kicks in client-side,
 *     so the dashboard stays usable.
 *
 * In production where the dashboard sits behind auth, deploy with the
 * `auth` middleware applied to the `/api/dashboard` group — the endpoint
 * will then return real user/role data and `useRole()` will see the
 * server-side identity.
 */
export default new Action({
  name: 'Dashboard Auth Me',
  description: 'Returns the authenticated user + their RBAC roles for dashboard role gating.',
  method: 'GET',
  apiResponse: true,
  async handle(request) {
    const user = (request as any)?.user ?? (request as any)?._authenticatedUser ?? null

    if (!user || typeof user !== 'object' || typeof (user as { id?: unknown }).id !== 'number') {
      const res: MeResponse = { user: null, roles: [], unauthenticated: true }
      return res
    }

    const userId = (user as { id: number }).id

    let roles: string[] = []
    try {
      const records = await getUserRoles(userId)
      roles = records.map(r => r.name)
    }
    catch (err) {
      // RBAC store not configured, migrations not run, or DB unreachable.
      // Empty roles → useRole will fall back to its dev default. We don't
      // want to 500 the dashboard just because the role tables haven't
      // been migrated yet on a fresh project.
      console.warn('[dashboard/auth/me] getUserRoles failed:', err instanceof Error ? err.message : err)
    }

    const res: MeResponse = {
      user: {
        id: userId,
        name: (user as { name?: string | null }).name ?? null,
        email: (user as { email?: string | null }).email ?? null,
      },
      roles,
    }
    return res
  },
})
