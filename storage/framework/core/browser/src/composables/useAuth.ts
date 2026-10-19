import type { StacksBrowserConfig } from '../types/globals'
import type { AuthComposable, AuthUser, ErrorResponse, LoginError, LoginResponse, LoginResult, MeResponse, RegisterError, RegisterResponse, SessionExpiredEvent, SessionExpiredListener, TwoFactorLoginChallenge, UserData } from '../types/dashboard'
import type { SessionHandoffPack } from '@stacksjs/composables'
import { readSessionHandoff, readSessionHandoffCode, stripSessionHandoff, useStorage } from '@stacksjs/composables'
/// <reference lib="dom" />
import { ref } from '@stacksjs/stx'
import { CSRF_COOKIE_NAME, readCsrfToken, withCsrfHeader } from './csrf'

export type { SessionExpiredEvent, SessionExpiredListener } from '../types/dashboard'

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

const stacksConfig: StacksBrowserConfig = globalThis.__STACKS_CONFIG__ || {}
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
const HANDOFF_PATH: string = stacksConfig.AUTH_HANDOFF_PATH || '/auth/handoff'

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

/**
 * Which session the page is on. Bumped whenever the credential is replaced
 * (sign-in, social handoff) or dropped (logout, expiry).
 *
 * Every request remembers the epoch it was sent under, and an answer only
 * acts on the session if that is still the current one. That one comparison
 * covers both halves of the burst problem: the first 401 of a burst ends the
 * session and bumps the epoch, so the rest of the burst are answers about a
 * session that no longer exists and do nothing - one clear, one listener call,
 * one redirect. And a slow request sent before a sign-in cannot end the
 * session that sign-in started.
 */
let sessionEpoch = 0

/** The shared `/api/me` request, tagged with the epoch it belongs to. */
let inFlightMe: { epoch: number, promise: Promise<UserData | null> } | null = null

const sessionExpiredListeners = new Set<SessionExpiredListener>()

/** The path an `authGuard()` protected, so an expiry there redirects once. */
let guardedPath: string | null = null
let guardRedirectInstalled = false

/**
 * Run `listener` when the client ends a session on its own: a 401 from the
 * identity endpoint, or a refused refresh. Called once per session however
 * many requests failed together, and not for `logout()`, which the caller
 * already knows about. Returns an unsubscribe function.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

/**
 * Finish a social sign-in that arrived as a redirect (stacksjs/stacks#2236).
 *
 * Call it on the landing page:
 *
 *     const { completeSocialLogin } = useAuth()
 *     completeSocialLogin()
 *
 * With no argument it reads the handoff `socialHandoffRedirect()` put in the
 * fragment. Pass a pack explicitly if it reached the page another way.
 *
 * The point is that this is the ONLY supported way in — before it existed, an
 * app's callback action returned an HTML page whose inline script wrote
 * `localStorage` by hand, and had to know that `useStorage` JSON-stringifies
 * on write. Getting that wrong stored the literal `[object Object]` as the
 * user. Here the values go through the same refs an ordinary `login()` writes,
 * so the encoding cannot be re-derived incorrectly — there is nothing to
 * derive.
 *
 * Returns false when there was no handoff to apply, so a page can call it
 * unconditionally on every load.
 */
function applySessionHandoff(pack?: SessionHandoffPack | null): boolean {
  const resolved = pack ?? (typeof window !== 'undefined' ? readSessionHandoff(window.location.hash) : null)

  if (!resolved)
    return false

  sessionEpoch++
  token.value = resolved.token
  // A token-only handoff represents a fixed-lifetime session. Remove a
  // refresh credential left by an older session instead of silently making
  // the new session renewable after its access token expires.
  refreshToken.value = resolved.refreshToken ?? ''

  if (resolved.user !== undefined && resolved.user !== null)
    applyUser(resolved.user as UserData)

  isAuthenticated.value = true

  // Strip the fragment immediately. It is not sent to servers, so it stayed
  // out of logs and Referer on the way here, but it is in browser history —
  // and history is shared with anyone who later uses the machine. replaceState
  // so the Back button does not return to a URL still carrying the pack.
  if (typeof window !== 'undefined' && !pack)
    stripHandoffFragment()

  return true
}

/** Remove a handoff pack or code from the address bar and history entry. */
function stripHandoffFragment(): void {
  const rest = stripSessionHandoff(window.location.hash)
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${rest}`)
}

/**
 * Redeem a one-use social sign-in code for the session it stands for.
 *
 * The default social callback no longer puts bearer or refresh tokens in the
 * URL: it redirects with a code that is useless on its own. An HttpOnly
 * cookie set by the same callback binds the code to this browser, so the
 * request carries credentials. Resolves null on any refusal, malformed answer
 * or network failure; the caller then leaves the existing session alone.
 */
async function redeemHandoffCode(code: string): Promise<SessionHandoffPack | null> {
  try {
    const response = await fetch(`${baseUrl}${HANDOFF_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: withCsrfHeader({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }),
      body: JSON.stringify({ code }),
    })
    if (response.status !== 200)
      return null

    const data = await response.json() as Record<string, unknown> | null
    if (!data || typeof data !== 'object')
      return null

    const accessToken = data.access_token ?? data.token
    const refresh = data.refresh_token
    if (typeof accessToken !== 'string' || accessToken.length === 0)
      return null
    if (typeof data.user !== 'object' || data.user === null)
      return null
    if (refresh !== undefined && (typeof refresh !== 'string' || refresh.length === 0))
      return null

    return {
      token: accessToken,
      refreshToken: refresh as string | undefined,
      user: data.user,
      expiresIn: typeof data.expires_in === 'number' ? data.expires_in : undefined,
    }
  }
  catch (error) {
    console.error('Error redeeming sign-in code:', error)
    return null
  }
}

function clearSession(): void {
  sessionEpoch++
  token.value = ''
  refreshToken.value = ''
  user.value = null
  isAuthenticated.value = false
}

/** Whether the page holds anything that represents a session. */
function holdsSession(): boolean {
  return !!token.value || !!refreshToken.value || user.value !== null || isAuthenticated.value
}

/**
 * End the session the client found invalid, once.
 *
 * `epoch` is the session the failing request was sent under. When it is no
 * longer current, an earlier answer already ended that session (or a new one
 * began), so this answer has nothing to end.
 */
function expireSession(epoch: number, event: SessionExpiredEvent): void {
  if (epoch !== sessionEpoch)
    return

  const hadSession = holdsSession()
  clearSession()

  if (!hadSession)
    return

  for (const listener of [...sessionExpiredListeners]) {
    try {
      listener(event)
    }
    catch (error) {
      console.error('Error in session expiry listener:', error)
    }
  }
}

/** Structural equality for JSON-shaped data, so an unchanged `/me` answer is recognisable. */
function sameJson(a: unknown, b: unknown): boolean {
  if (a === b)
    return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null)
    return false
  if (Array.isArray(a) !== Array.isArray(b))
    return false

  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length)
    return false

  return keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameJson(left[key], right[key]))
}

/**
 * Store a user without replacing an identical one.
 *
 * `/api/me` is asked on most page loads and after every unrenewable 401. When
 * it answers with what the page already has, assigning the fresh object would
 * still notify every consumer of `user` - re-rendering the nav, re-running
 * effects that fetch per-user data - for no change at all.
 */
function applyUser(next: UserData): void {
  if (!sameJson(user.value, next))
    user.value = next
  if (!isAuthenticated.value)
    isAuthenticated.value = true
}

/**
 * Statuses that say the refresh endpoint could not answer, rather than that it
 * refused: a deploy, an overloaded API, a proxy timeout. They keep the session,
 * like a network error does.
 */
function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

/**
 * Exchange the refresh token for a new access token.
 *
 * Resolves `true` when the session was renewed. Resolves `false` when the
 * server refused — the refresh token is spent, revoked or expired, and the
 * session is over; state is cleared here.
 *
 * THROWS when the exchange could not be completed (offline, DNS, the API being
 * restarted, a 5xx). That distinction is the whole point: treating an
 * unreachable server as a refusal signs out working users on a network blip.
 * Callers catch it and keep the session.
 */
async function performRefresh(): Promise<boolean> {
  if (!refreshToken.value)
    return false

  const epoch = sessionEpoch
  const url = `${baseUrl}${REFRESH_PATH}`
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: withCsrfHeader({
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }),
    body: JSON.stringify({ refresh_token: refreshToken.value }),
  })

  if (isTransientStatus(response.status))
    throw new Error(`Refresh unavailable (status ${response.status})`)

  if (!response.ok) {
    // A refusal is authoritative — the token cannot be reused.
    expireSession(epoch, { reason: 'refresh-refused', status: response.status, url })
    return false
  }

  const data = await response.json() as { access_token?: string, refresh_token?: string, token?: string }
  const nextAccess = data.access_token ?? data.token
  if (!nextAccess) {
    expireSession(epoch, { reason: 'refresh-refused', status: response.status, url })
    return false
  }

  // A sign-out or a new sign-in landed while the exchange was out: this
  // token belongs to a session the page has moved on from.
  if (epoch !== sessionEpoch)
    return false

  token.value = nextAccess
  // Rotation is optional server-side; keep the existing one when none comes back.
  if (data.refresh_token)
    refreshToken.value = data.refresh_token

  return true
}

/**
 * Refresh the session, collapsing concurrent callers onto one exchange.
 *
 * Never rejects: an exchange that could not be completed resolves `false`
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

function resolveTarget(input: string): string {
  return input.startsWith('http') ? input : `${baseUrl}${input}`
}

/**
 * Whether a 401 from `target` speaks for this page's session. A 401 from some
 * other origin is that service's business, not a reason to sign anyone out.
 */
function speaksForSession(target: string): boolean {
  const pageOrigin = typeof window !== 'undefined' ? window.location?.origin : undefined
  try {
    const origin = new URL(target, pageOrigin).origin
    return origin === pageOrigin || (!!baseUrl && origin === new URL(baseUrl, pageOrigin).origin)
  }
  catch {
    return false
  }
}

interface SessionRequest {
  response: globalThis.Response
  /** The epoch the request was sent under. */
  epoch: number
  /**
   * A final 401 that says the credential is not accepted: either there was no
   * refresh token to try, or a renewed token was refused too. False for a 401
   * left standing because the refresh could not reach the server.
   */
  unauthenticated: boolean
}

async function sendWithSession(input: string, init: RequestInit): Promise<SessionRequest> {
  const epoch = sessionEpoch
  const target = resolveTarget(input)

  const send = (): Promise<globalThis.Response> => {
    const headers = new Headers(init.headers)
    if (token.value)
      headers.set('Authorization', `Bearer ${token.value}`)
    headers.set('Accept', 'application/json')

    const method = (init.method || 'GET').toUpperCase()
    const pageOrigin = typeof window !== 'undefined' ? window.location?.origin : undefined
    const sameOrigin = !!pageOrigin && new URL(target, pageOrigin).origin === pageOrigin
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && sameOrigin && !headers.has(CSRF_COOKIE_NAME)) {
      const csrfToken = readCsrfToken()
      if (csrfToken)
        headers.set(CSRF_COOKIE_NAME, csrfToken)
    }

    return fetch(target, {
      credentials: 'same-origin',
      ...init,
      headers,
    })
  }

  const sentWith = token.value
  const response = await send()
  if (response.status !== 401 || !speaksForSession(target) || epoch !== sessionEpoch)
    return { response, epoch, unauthenticated: false }

  if (!refreshToken.value)
    return { response, epoch, unauthenticated: true }

  // Another request of the same burst already rotated the access token while
  // this one was out: retry with it rather than spending another exchange.
  const renewed = (token.value && token.value !== sentWith) ? true : await refreshSession()
  if (!renewed || epoch !== sessionEpoch) {
    // Refused: `performRefresh` already ended the session. Unreachable: the
    // session is kept and this 401 says nothing more about it.
    return { response, epoch, unauthenticated: false }
  }

  const retried = await send()
  return { response: retried, epoch, unauthenticated: retried.status === 401 && epoch === sessionEpoch }
}

/**
 * `fetch` with the access token attached, retrying once through a refresh on a
 * 401.
 *
 * The retry is attempted only when a refresh token exists and the first
 * response was a 401 — a 403 is an authorization decision, not an expiry, and
 * refreshing would not change it.
 *
 * A same-origin 401 that cannot be renewed is not taken as a sign-out on its
 * own: plenty of 401s are about the request, not the session (a tampered
 * signed URL, a step-up check). It makes the client ask `/api/me` instead -
 * one shared request for the whole burst - and only that answer's 401 ends the
 * session, once.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const result = await sendWithSession(input, init)

  if (result.unauthenticated && result.epoch === sessionEpoch && holdsSession()) {
    try {
      await loadAuthUser()
    }
    catch {
      // Verification is best effort; the caller still gets its own response.
    }
  }

  return result.response
}

/**
 * Ask the server who is signed in, sharing one request between every caller
 * of the same session.
 *
 * Only a 401 ends the session. A network failure, a 5xx, a 403 or any other
 * answer is not the server saying the credential is invalid, so the token and
 * user are kept and the last known user is returned. A 403 in particular is
 * an authorization decision about an identity the server did recognise:
 * signing the user out would only send them through a login that succeeds and
 * lands them on the same refusal.
 */
function loadAuthUser(): Promise<UserData | null> {
  if (inFlightMe && inFlightMe.epoch === sessionEpoch)
    return inFlightMe.promise

  const epoch = sessionEpoch
  const entry = {
    epoch,
    promise: requestAuthUser(epoch).finally(() => {
      if (inFlightMe === entry)
        inFlightMe = null
    }),
  }
  inFlightMe = entry

  return entry.promise
}

async function requestAuthUser(epoch: number): Promise<UserData | null> {
  let result: SessionRequest
  try {
    // Current identity and permissions must never come from an offline copy.
    result = await sendWithSession(ME_PATH, { cache: 'no-store' })
  }
  catch (error) {
    // A thrown fetch means the request never completed — offline, DNS, the
    // API restarting. That is not a statement about the session, so the token
    // and user are kept and the next call can succeed. Clearing here signed
    // users out on a network blip, and authGuard then sent them to /login.
    console.error('Error fetching user:', error)
    return user.value
  }

  const { response } = result

  if (response.status === 401) {
    if (result.unauthenticated)
      expireSession(epoch, { reason: 'unauthorized', status: 401, url: resolveTarget(ME_PATH) })
    // Otherwise the refresh could not be completed or already ended the
    // session; either way there is nothing more to do here.
    return epoch === sessionEpoch ? user.value : null
  }

  if (!response.ok)
    return user.value

  let data: MeResponse
  try {
    data = await response.json() as MeResponse
  }
  catch (error) {
    // A 200 that is not JSON is a proxy or error page, not an identity.
    console.error('Error reading user:', error)
    return user.value
  }

  // The session changed while the request was out; its answer is stale.
  if (epoch !== sessionEpoch)
    return user.value

  applyUser(data)
  return user.value
}

/** Redirect a guarded page to /login when its session ends, once. */
function installGuardRedirect(): void {
  if (typeof window === 'undefined')
    return

  guardedPath = window.location?.pathname ?? null
  if (guardRedirectInstalled)
    return
  guardRedirectInstalled = true

  onSessionExpired(() => {
    if (typeof window === 'undefined' || guardedPath === null)
      return
    // Only the page that asked for protection: after client-side navigation
    // to a public page, an expiry is no reason to leave it.
    if (window.location?.pathname === guardedPath)
      window.location.replace('/login')
  })
}

export function useAuth(): AuthComposable {
  function isTwoFactorChallenge(data: unknown): data is TwoFactorLoginChallenge {
    if (!data || typeof data !== 'object')
      return false
    const candidate = data as Record<string, unknown>
    return candidate.requires_two_factor === true && typeof candidate.challenge_token === 'string' && candidate.challenge_token.length > 0
  }

  function isLoginResponse(data: unknown): data is LoginResponse {
    if (!data || typeof data !== 'object')
      return false
    const candidate = data as Record<string, unknown>
    return typeof candidate.token === 'string'
      && candidate.token.length > 0
      && typeof candidate.user === 'object'
      && candidate.user !== null
      && (candidate.refresh_token === undefined
        || (typeof candidate.refresh_token === 'string' && candidate.refresh_token.length > 0))
  }

  function storeTokenPack(data: LoginResponse): void {
    sessionEpoch++
    token.value = data.token
    // A fixed-lifetime browser policy deliberately returns no refresh token.
    // Clear any credential left by an earlier refresh-capable login so it
    // cannot silently turn the new fixed session back into a renewable one.
    refreshToken.value = data.refresh_token ?? ''
  }

  async function fetchAuthUser(): Promise<UserData | null> {
    // `sendWithSession` turns a 401 into refresh-then-retry, so an expired
    // access token renews instead of ending the session (stacksjs/stacks#2235),
    // and only a 401 the refresh could not cure clears state. Every other
    // failure keeps the session: see `loadAuthUser`.
    return await loadAuthUser()
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
      sessionEpoch++
      token.value = data.token
      // RegisterAction returns the same OAuth2-shaped pack LoginAction does
      // (#2212). Storing the refresh token is what lets the session outlive
      // the access token's one-hour lifetime.
      const refreshed = (data as { refresh_token?: string }).refresh_token
      refreshToken.value = refreshed ?? ''
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

  async function login(user: AuthUser): Promise<LoginResult | LoginError> {
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

      const data = await response.json() as LoginResult
      if (isTwoFactorChallenge(data))
        return data
      if (!isLoginResponse(data))
        throw new Error('The login response did not contain a valid session.')

      storeTokenPack(data)
      await fetchAuthUser() // Fetch user data after successful login
      return data
    }
    catch (error) {
      return error as LoginError
    }
  }

  async function verifyTwoFactorLogin(challengeToken: string, code: string): Promise<LoginResponse | LoginError> {
    try {
      const response = await fetch(`${baseUrl}/verify-two-factor-login`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: withCsrfHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ challenge_token: challengeToken, code }),
      })
      if (!response.ok) {
        const errorData = await response.json() as ErrorResponse
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json() as LoginResponse
      if (!isLoginResponse(data))
        throw new Error('The two-factor response did not contain a valid session.')
      storeTokenPack(data)
      await fetchAuthUser()
      return data
    }
    catch (error) {
      return error as LoginError
    }
  }

  async function logout() {
    // Read via the same `useStorage`-backed ref the rest of the composable
    // uses. Reading localStorage directly here meant cross-tab logouts
    // (token cleared in another tab via useStorage) were invisible to the
    // request, so we'd POST /logout with a stale token and surface a 401.
    const currentToken = token.value
    const response = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: withCsrfHeader({
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
        Accept: 'application/json',
      }),
    })
    if (!response.ok)
      throw new Error(`Logout failed with status ${response.status}`)

    // useStorage's setter syncs the underlying localStorage so other tabs see
    // the change via `storage` events. Clear only after server revocation
    // succeeds: otherwise the HttpOnly cookie remains valid while the UI lies
    // that the user signed out, and the next identity request signs them in
    // again. The refresh token must go too, or refresh can resurrect a logout.
    clearSession()
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
   * The shapes a server can hand a session over in:
   *
   *   - **Cookie** (preferred). The callback replies `303` with
   *     `Set-Cookie: authCookie(token)` and no body. Nothing secret ever
   *     touches the URL or the DOM. Call this with no argument; it hydrates
   *     `user` from the cookie-authenticated `/api/me`.
   *   - **One-use code** (the default social callback). The fragment carries
   *     `stx_handoff=<code>`, never a token. With no argument this strips it
   *     from history, POSTs it to `/auth/handoff` (`AUTH_HANDOFF_PATH`) with
   *     the browser-binding cookie, and stores the returned session. A refused
   *     or unreachable redemption resolves `null` and changes nothing.
   *   - **Token pack.** When a cookie is not an option — a cross-origin API,
   *     say, where the browser would not send one — hand the pack straight in
   *     and it is stored through the same path `login()` uses. A `stx_auth`
   *     pack in the fragment, from a custom callback, still works too.
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
  async function completeSocialLogin(pack?: SessionHandoffPack | null): Promise<UserData | null> {
    // A one-use code from the default callback. Strip it from history before
    // anything else, then redeem it; a refused or unreachable redemption
    // leaves whatever session the page already had untouched.
    let applied = false
    const code = !pack && typeof window !== 'undefined' ? readSessionHandoffCode(window.location.hash) : null
    if (code) {
      stripHandoffFragment()
      const redeemed = await redeemHandoffCode(code)
      if (!redeemed)
        return null
      applied = applySessionHandoff(redeemed)
    }

    // Fragment or explicit pack (custom callbacks still send one): it writes
    // the tokens through the same refs `login()` uses and strips the fragment
    // out of history.
    if (!applied)
      applied = applySessionHandoff(pack)

    // Then confirm with the server. This is what covers the cookie handoff,
    // where the browser arrives holding no tokens at all and the session lives
    // in an httpOnly cookie the page cannot read — `applySessionHandoff`
    // returns false and there is nothing to apply, but the request is
    // authenticated all the same.
    //
    // Also worth the round-trip when a pack WAS applied: the pack is a claim
    // made by a redirect, and `/api/me` is the server agreeing with it. An
    // expired or revoked token then fails here rather than at the next call,
    // which is where a confusing session comes from.
    const confirmed = await fetchAuthUser()
    if (confirmed || applied)
      return confirmed

    return null
  }

  return {
    user,
    isAuthenticated,
    token,
    getToken: () => token.value,
    register,
    login,
    verifyTwoFactorLogin,
    logout,
    fetchAuthUser,
    onSessionExpired,
    completeSocialLogin,
    checkAuthentication,
    refreshToken,
    getRefreshToken: () => refreshToken.value,
    refreshSession,
    authFetch,
  }
}

/**
 * Client navigation guard. Call it in a page's setup, or a router hook.
 * Pass `{ guest: true }` for guest-only pages.
 *
 * A protected page redirects to /login when nothing says the visitor is signed
 * in. When a stored token exists but has not been confirmed yet (a fresh page
 * load), it asks `/api/me` instead of redirecting: the token is kept through a
 * network failure or a 5xx, and only a 401 sends the visitor to sign in. A
 * session that ends later on the same page - many requests failing at once
 * included - redirects exactly once.
 *
 * This only controls client navigation. Guard server pages and actions
 * independently.
 */
export function authGuard(options: { guest?: boolean } = {}): void {
  const guest = options.guest ?? false
  const { isAuthenticated, fetchAuthUser } = useAuth()

  if (guest) {
    // Guest-only page: block if authenticated
    if (isAuthenticated.value) {
      window.location.replace('/')
    }
    return
  }

  if (isAuthenticated.value) {
    installGuardRedirect()
    return
  }

  if (token.value) {
    // Unconfirmed, not refused: let the identity check decide.
    installGuardRedirect()
    void fetchAuthUser()
    return
  }

  window.location.replace('/login')
}
