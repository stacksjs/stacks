import type { Ref } from 'vue'

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

export interface RegisterResponse {
  data: {
    token: string
    user: {
      id: number
      email: string
      name: string
    }
  }
}

export type LoginResponse = RegisterResponse

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

export interface MeResponse {
  user: UserData
}

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
