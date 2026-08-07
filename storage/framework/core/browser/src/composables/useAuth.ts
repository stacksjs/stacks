import type { AuthComposable, AuthUser, ErrorResponse, LoginError, LoginResponse, MeResponse, RegisterError, RegisterResponse, UserData } from '../types/dashboard'
import { useStorage } from '@stacksjs/composables'
/// <reference lib="dom" />
import { ref } from '@stacksjs/stx'
import { withCsrfHeader } from './csrf'

const token = useStorage('token', '')

/**
 * The refresh token the server has always returned beside the access token.
 *
 * Until now nothing on the client read it: `refresh_token` appeared exactly
 * once in the browser surface, as a field on a TypeScript interface. So every
 * app on this composable had sessions that ended when the access token expired
 * — one hour, per `config.auth.tokenExpiry` — while the server sat ready to
 * exchange a refresh token it was never sent (stacksjs/stacks#2235).
 */
const refreshToken = useStorage('refresh_token', '')

const stacksConfig = (globalThis as any).__STACKS_CONFIG__ || {}
const baseUrl = stacksConfig.API_URL || (typeof window !== 'undefined' ? window.location.origin : '')

/**
 * Endpoint paths, overridable through `__STACKS_CONFIG__`.
 *
 * `/api/me` rather than `/me` by default: in the split views/API topology the
 * views server forwards only `/api/**` and non-GET verbs, so a bare `GET /me`
 * is swallowed by page routing and 404s. The old hardcoded `/me` made this
 * composable unusable there (see #2230 for the proxy predicate itself).
 */
const ME_PATH: string = stacksConfig.AUTH_ME_PATH || '/api/me'
const REFRESH_PATH: string = stacksConfig.AUTH_REFRESH_PATH || '/auth/refresh'

// Create singleton state
const user = ref<UserData | null>(null)
const isAuthenticated = ref(false)

/**
 * The in-flight refresh, shared by every caller.
 *
 * Single-use rotation makes this a correctness requirement rather than a
 * performance tweak: two concurrent 401s each exchanging the same refresh
 * token means the second exchange presents one the server already consumed,
 * and the session dies. Module-level so it is shared across every `useAuth()`
 * call in the page.
 */
let inFlightRefresh: Promise<boolean> | null = null

function clearSession(): void {
  token.value = ''
  refreshToken.value = ''
  user.value = null
  isAuthenticated.value = false
}

/**
 * Exchange the refresh token for a new access token.
 *
 * Resolves `true` when the session was renewed. Resolves `false` when the
 * server refused — the refresh token is spent, revoked or expired, and the
 * session is over; state is cleared here.
 *
 * THROWS when the exchange could not be attempted at all (offline, DNS, the
 * API being restarted). That distinction is the whole point: treating an
 * unreachable server as a refusal signs out working users on a network blip.
 * Callers catch it and keep the session.
 */
async function performRefresh(): Promise<boolean> {
  if (!refreshToken.value)
    return false

  const response = await fetch(`${baseUrl}${REFRESH_PATH}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: withCsrfHeader({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
    body: JSON.stringify({ refresh_token: refreshToken.value }),
  })

  if (!response.ok) {
    // A refusal is authoritative — the token cannot be reused.
    clearSession()
    return false
  }

  const data = await response.json() as { access_token?: string, refresh_token?: string, token?: string }
  const nextAccess = data.access_token ?? data.token
  if (!nextAccess) {
    clearSession()
    return false
  }

  token.value = nextAccess
  // Rotation is optional server-side; keep the existing one when none comes back.
  if (data.refresh_token)
    refreshToken.value = data.refresh_token

  return true
}

/**
 * Refresh the session, collapsing concurrent callers onto one exchange.
 *
 * Never rejects: an exchange that could not be attempted resolves `false`
 * without clearing state, so a caller can tell "signed out" from "could not
 * reach the server" by checking whether `token.value` survived.
 */
export async function refreshSession(): Promise<boolean> {
  if (inFlightRefresh)
    return inFlightRefresh

  inFlightRefresh = performRefresh()
    .catch(() => {
      // Unreachable, not refused. Leave the session intact so the next
      // attempt can succeed once connectivity returns.
      return false
    })
    .finally(() => {
      inFlightRefresh = null
    })

  return inFlightRefresh
}

/**
 * `fetch` with the access token attached, retrying once through a refresh on a
 * 401.
 *
 * The retry is attempted only when a refresh token exists and the first
 * response was a 401 — a 403 is an authorization decision, not an expiry, and
 * refreshing would not change it.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = (): Promise<Response> => fetch(input.startsWith('http') ? input : `${baseUrl}${input}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
      Accept: 'application/json',
    },
  })

  const response = await send()
  if (response.status !== 401 || !refreshToken.value)
    return response

  const renewed = await refreshSession()
  if (!renewed)
    return response

  return await send()
}

export function useAuth(): AuthComposable {
  async function fetchAuthUser(): Promise<UserData | null> {
    try {
      if (!token.value) {
        isAuthenticated.value = false
        user.value = null
        return null
      }

      // `authFetch` turns a 401 into refresh-then-retry, so an expired access
      // token renews instead of ending the session. Previously any non-ok
      // response cleared state, which made a one-hour-old token and a revoked
      // one indistinguishable — every session died at the access token's
      // lifetime (stacksjs/stacks#2235).
      const response = await authFetch(ME_PATH)

      if (!response.ok) {
        clearSession()
        return null
      }

      const data = await response.json() as MeResponse
      user.value = data
      isAuthenticated.value = true

      return data
    }
    catch (error) {
      // A thrown fetch means the request never completed — offline, DNS, the
      // API restarting. That is not a statement about the session, so the
      // token is kept and the next call can succeed. Clearing here signed
      // users out on a network blip and then, because the token was gone,
      // made it look like they had never been signed in.
      console.error('Error fetching user:', error)
      isAuthenticated.value = false
      user.value = null
      return null
    }
  }

  async function checkAuthentication(): Promise<boolean> {
    try {
      const userData = await fetchAuthUser()
      return userData !== null
    }
    catch (error) {
      console.error('Error checking authentication:', error)
      return false
    }
  }

  async function register(user: AuthUser): Promise<RegisterResponse | RegisterError> {
    const url = `${baseUrl}/register`
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: withCsrfHeader({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(user),
    })

    const data = await response.json() as RegisterResponse | RegisterError

    if (isRegisterError(data)) {
      return data
    }

    if (isRegisterResponse(data)) {
      token.value = data.token
      // RegisterAction returns the same OAuth2-shaped pack LoginAction does
      // (#2212). Storing the refresh token is what lets the session outlive
      // the access token's one-hour lifetime.
      const refreshed = (data as { refresh_token?: string }).refresh_token
      if (refreshed)
        refreshToken.value = refreshed
      return data
    }

    return data
  }

  function isRegisterError(data: RegisterResponse | RegisterError): data is RegisterError {
    return 'errors' in data
  }

  function isRegisterResponse(data: RegisterResponse | RegisterError): data is RegisterResponse {
    return 'token' in data && 'user' in data
  }

  async function login(user: AuthUser): Promise<LoginResponse | LoginError> {
    try {
      const url = `${baseUrl}/login`
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: withCsrfHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(user),
      })

      if (!response.ok) {
        const errorData = await response.json() as ErrorResponse
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json() as LoginResponse
      token.value = data.token
      const refreshed = (data as { refresh_token?: string }).refresh_token
      if (refreshed)
        refreshToken.value = refreshed
      await fetchAuthUser() // Fetch user data after successful login
      return data
    }
    catch (error) {
      return error as LoginError
    }
  }

  async function logout() {
    try {
      // Read via the same `useStorage`-backed ref the rest of the composable
      // uses. Reading localStorage directly here meant cross-tab logouts
      // (token cleared in another tab via useStorage) were invisible to the
      // request, so we'd POST /logout with a stale token and surface a 401.
      const currentToken = token.value
      if (currentToken) {
        await fetch(`${baseUrl}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            Accept: 'application/json',
          },
        })
      }
    }
    catch (error) {
      console.error('Error during logout:', error)
    }
    finally {
      // useStorage's setter syncs the underlying localStorage so other tabs
      // see the change via `storage` events. Setting localStorage manually
      // would skip that broadcast. Clears the refresh token too — leaving it
      // behind would let a later refresh silently resurrect a session the
      // user just ended.
      clearSession()
    }
  }


  /**
   * Finish a sign-in that completed on the server, typically an OAuth redirect.
   *
   * The browser arrives back from the provider with a session the server
   * established and no client state at all. Before this existed, the only way
   * to bridge that gap was for the callback to return an HTML page with an
   * inline script writing the framework's own storage keys by hand
   * (stacksjs/stacks#2236) — which meant re-deriving `useStorage`'s encoding.
   * Getting it wrong was easy and quiet: `useStorage` JSON-stringifies on
   * write, so the string that belongs in `localStorage` under `token` is
   * `"abc"` WITH the quotes, and passing the user object straight to
   * `setItem` stored the literal `[object Object]`.
   *
   * Two shapes, because there are two ways a server can hand a session over:
   *
   *   - **Cookie** (preferred). The callback replies `303` with
   *     `Set-Cookie: authCookie(token)` and no body. Nothing secret ever
   *     touches the URL or the DOM. Call this with no argument; it hydrates
   *     `user` from the cookie-authenticated `/api/me`.
   *   - **Token pack.** When a cookie is not an option — a cross-origin API,
   *     say, where the browser would not send one — hand the pack straight in
   *     and it is stored through the same path `login()` uses.
   *
   * Returns the signed-in user, or `null` when the session did not take.
   *
   * @example
   * ```ts
   * // after redirecting back from /auth/github/callback
   * const user = await completeSocialLogin()
   * if (user) location.replace('/account')
   * ```
   */
  async function completeSocialLogin(
    pack?: { token?: string, refresh_token?: string } | null,
  ): Promise<UserData | null> {
    if (pack?.token)
      token.value = pack.token
    if (pack?.refresh_token)
      refreshToken.value = pack.refresh_token

    return fetchAuthUser()
  }

  return {
    user,
    isAuthenticated,
    token,
    getToken: () => token.value,
    register,
    login,
    logout,
    fetchAuthUser,
    completeSocialLogin,
    checkAuthentication,
    refreshToken,
    getRefreshToken: () => refreshToken.value,
    refreshSession,
    authFetch,
  }
}

// Strict auth guard middleware
// Usage: call in setup() of page/component, or in router beforeEach
// Pass { guest: true } for guest-only pages
export function authGuard(options: { guest?: boolean } = {}): void {
  const guest = options.guest ?? false
  const { isAuthenticated } = useAuth()

  if (guest) {
    // Guest-only page: block if authenticated
    if (isAuthenticated.value) {
      window.location.replace('/')
    }
    return
  }

  // Auth-only page: block if not authenticated
  if (!isAuthenticated.value) {
    window.location.replace('/login')
  }
}
