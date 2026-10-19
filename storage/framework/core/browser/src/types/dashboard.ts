import type { SessionHandoffPack } from '@stacksjs/composables'
import type { Ref } from '@stacksjs/stx'

export interface ValidationError {
  [key: string]: {
    message: string
  }[]
}

export type ResponseError = {
  error: string
} | ValidationError

export function isGeneralError(error: ResponseError): error is { error: string } {
  return 'error' in error
}

export interface RegisterError {
  errors?: ResponseError
  error?: string
  message?: string
}

export type LoginError = RegisterError

// LoginAction/RegisterAction/AuthUserAction respond via `response.json(...)`,
// which serializes flat (see @stacksjs/bun-router's ResponseFactory.json) —
// there is no `{ data: ... }` envelope, unlike endpoints built on
// `response.success()` or a JsonResource. These types mirror the actual
// flat wire shape.
export interface RegisterResponse {
  token: string
  user: {
    id: number
    email: string
    name: string
  }
}

// LoginAction additionally mints an OAuth2-compatible token pack; `token`
// is kept alongside `access_token` for backward compatibility.
export interface LoginResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  token: string
  user: {
    id: number
    email: string
    name: string
  }
}

export interface TwoFactorLoginChallenge {
  requires_two_factor: true
  challenge_token: string
}

export type LoginResult = LoginResponse | TwoFactorLoginChallenge

export interface Response<T> {
  errors: ResponseError
  data: T
}

export interface AuthUser {
  email: string
  password: string
  remember?: boolean
}

export interface ErrorResponse {
  message: string
}

export interface UserData {
  id: number
  email: string
  name: string
}

export type MeResponse = UserData

/**
 * Why `useAuth` ended a session on its own, as passed to `onSessionExpired`
 * listeners.
 *
 * - `unauthorized`: the identity endpoint answered 401 for the current
 *   credential, either directly or when a 401 elsewhere made the client check.
 * - `refresh-refused`: the server refused to exchange the refresh token.
 */
export interface SessionExpiredEvent {
  reason: 'unauthorized' | 'refresh-refused'
  /** The HTTP status that ended the session. */
  status: number
  /** The request URL that produced it. */
  url: string
}

export type SessionExpiredListener = (event: SessionExpiredEvent) => void

export interface AuthComposable {
  isAuthenticated: Ref<boolean>
  user: Ref<UserData | null>
  login: (user: AuthUser) => Promise<LoginResult | LoginError>
  verifyTwoFactorLogin: (challengeToken: string, code: string) => Promise<LoginResponse | LoginError>
  register: (user: AuthUser) => Promise<RegisterResponse | RegisterError>
  /**
   * Ask `/api/me` who is signed in. Concurrent callers share one request.
   *
   * Only a 401 ends the session. A network failure, a 5xx, a 403 or any other
   * answer keeps the token and user and resolves the last known user (null
   * when none was loaded yet). An unchanged answer keeps the same `user`
   * object, so effects watching it do not run again.
   */
  fetchAuthUser: () => Promise<UserData | null>
  /**
   * Run `listener` when the client ends a session itself (a 401 from the
   * identity endpoint, or a refused refresh). It runs once per session, however
   * many requests failed together. Not called for `logout()`. Returns an
   * unsubscribe function.
   */
  onSessionExpired: (listener: SessionExpiredListener) => () => void
  /**
   * Finish a sign-in the server completed, typically an OAuth redirect.
   *
   * Call with no argument when the callback set the auth cookie (the
   * preferred handoff — nothing secret in the URL or the DOM); pass the token
   * pack when a cookie is not available. Either way the storage encoding stays
   * inside the framework instead of being re-derived by an inline script
   * (stacksjs/stacks#2236).
   */
  completeSocialLogin: (pack?: SessionHandoffPack | null) => Promise<UserData | null>
  checkAuthentication: () => Promise<boolean>
  logout: () => Promise<void>
  getToken: () => string | null
  /**
   * The ACCESS token. Short-lived — `config.auth.tokenExpiry` caps it at one
   * hour by default, so anything holding it must be prepared for it to expire
   * mid-session. `authFetch` handles that; a hand-rolled `fetch` does not.
   */
  token: Ref<string | null>
  /** The refresh token, exchanged at `/auth/refresh` when the access token expires. */
  refreshToken: Ref<string | null>
  getRefreshToken: () => string | null
  /**
   * Exchange the refresh token for a new access token. Resolves `false` when
   * the server refused (session over, state cleared) or when the exchange
   * could not be completed (offline, 5xx, 408 or 429 — state kept). Concurrent callers share
   * one exchange, which single-use rotation requires.
   */
  refreshSession: () => Promise<boolean>
  /**
   * `fetch` with the access token attached, retrying once through a refresh on
   * a 401. Use this for authenticated requests instead of a bare `fetch`.
   *
   * A same-origin 401 that cannot be renewed does not sign anyone out by
   * itself (a tampered signed URL also answers 401): it makes the client
   * re-check `/api/me`, shared by every request that failed together, and only
   * that check's 401 ends the session.
   */
  // `globalThis.Response` explicitly: this module declares its own generic
  // `Response<T>` (an API envelope, not the DOM class), which shadows it.
  authFetch: (input: string, init?: RequestInit) => Promise<globalThis.Response>
}
