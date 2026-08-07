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
  errors: ResponseError
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
  refresh_token: string
  token_type: string
  expires_in: number
  token: string
  user: {
    id: number
    email: string
    name: string
  }
}

export interface Response<T> {
  errors: ResponseError
  data: T
}

export interface AuthUser {
  email: string
  password: string
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

export interface AuthComposable {
  isAuthenticated: Ref<boolean>
  user: Ref<UserData | null>
  login: (user: AuthUser) => Promise<LoginResponse | LoginError>
  register: (user: AuthUser) => Promise<RegisterResponse | RegisterError>
  fetchAuthUser: () => Promise<UserData | null>
  /**
   * Finish a sign-in the server completed, typically an OAuth redirect.
   *
   * Call with no argument when the callback set the auth cookie (the
   * preferred handoff — nothing secret in the URL or the DOM); pass the token
   * pack when a cookie is not available. Either way the storage encoding stays
   * inside the framework instead of being re-derived by an inline script
   * (stacksjs/stacks#2236).
   */
  completeSocialLogin: (pack?: { token?: string, refresh_token?: string } | null) => Promise<UserData | null>
  checkAuthentication: () => Promise<boolean>
  logout: () => void
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
   * could not be attempted (offline — state kept). Concurrent callers share
   * one exchange, which single-use rotation requires.
   */
  refreshSession: () => Promise<boolean>
  /**
   * `fetch` with the access token attached, retrying once through a refresh on
   * a 401. Use this for authenticated requests instead of a bare `fetch`.
   */
  // `globalThis.Response` explicitly: this module declares its own generic
  // `Response<T>` (an API envelope, not the DOM class), which shadows it.
  authFetch: (input: string, init?: RequestInit) => Promise<globalThis.Response>
}
