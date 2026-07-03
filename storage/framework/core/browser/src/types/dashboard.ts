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
  checkAuthentication: () => Promise<boolean>
  logout: () => void
  getToken: () => string | null
  token: Ref<string | null>
}
