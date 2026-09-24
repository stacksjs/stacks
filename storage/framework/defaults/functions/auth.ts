import { resolveApiBaseUrl } from './api-url'
import type { Ref } from '@stacksjs/stx'
import type { AuthUser, LoginError, LoginResponse, LoginResult, MeResponse, RegisterCredentials, RegisterError, RegisterResponse, ResponseError, TwoFactorLoginChallenge, UserData } from '../types/dashboard'
import { withCsrfHeader } from '@stacksjs/browser/composables/csrf'
import { useStorage } from '@stacksjs/browser/composables/useStorage'
import { ref } from '@stacksjs/stx'

const token = useStorage('token', '')
const user = useStorage<UserData | null>('user', null, undefined, {

  serializer: {
    read: (v: string): UserData | null => {
      try {
        return v ? (JSON.parse(v) as UserData | null) : null
      }
      catch {
        return null
      }
    },
    write: (v: UserData | null): string => JSON.stringify(v),
  },
})

// The framework's auth routes are intentionally mounted at /login,
// /register, /me, and /logout rather than under the generated /api surface.
const baseUrl = resolveApiBaseUrl('')

// Create singleton state
const isAuthenticated = ref(false)

export function isTwoFactorChallenge(data: unknown): data is TwoFactorLoginChallenge {
  if (!data || typeof data !== 'object')
    return false
  const candidate = data as Record<string, unknown>
  return candidate.requires_two_factor === true && typeof candidate.challenge_token === 'string' && candidate.challenge_token.length > 0
}

export function isLoginResponse(data: unknown): data is LoginResponse {
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

/** Normalize a requested post-auth destination and reject cross-origin forms. */
export function safeAuthRedirect(value: unknown): string {
  if (typeof value !== 'string')
    return '/'
  const candidate = value.trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//'))
    return '/'

  try {
    const base = new URL('https://stacks.invalid')
    const resolved = new URL(candidate, base)
    if (resolved.origin !== base.origin)
      return '/'
    const target = `${resolved.pathname}${resolved.search}${resolved.hash}`
    return target.startsWith('/') && !target.startsWith('//') ? target : '/'
  }
  catch {
    return '/'
  }
}

export interface AuthComposable {
  isAuthenticated: Ref<boolean>
  user: { value: UserData | null }
  login: (user: AuthUser) => Promise<LoginResult | LoginError>
  verifyTwoFactorLogin: (challengeToken: string, code: string) => Promise<LoginResponse | LoginError>
  register: (user: RegisterCredentials) => Promise<RegisterResponse | RegisterError>
  fetchAuthUser: () => Promise<UserData | null>
  checkAuthentication: () => Promise<boolean>
  logout: () => Promise<void>
  getToken: () => string | null
  token: { value: string | null }
}

export function useAuth(): AuthComposable {
  function storeLogin(data: LoginResponse): void {
    token.value = data.token
    user.value = data.user
    isAuthenticated.value = true
  }

  async function fetchAuthUser(): Promise<UserData | null> {
    try {
      const response = await fetch(`${baseUrl}/me`, {
        credentials: 'same-origin',
        headers: {
          ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}),
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        isAuthenticated.value = false
        user.value = null
        return null
      }

      const data = await response.json() as MeResponse

      user.value = data
      isAuthenticated.value = true

      return data
    }
    catch (error) {
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

  async function register(credentials: RegisterCredentials): Promise<RegisterResponse | RegisterError> {
    const url = `${baseUrl}/register`
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: withCsrfHeader({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(credentials),
    })

    const data = await response.json() as RegisterResponse | RegisterError

    if (!response.ok || isRegisterError(data))
      return data

    if (isRegisterResponse(data)) {
      token.value = data.token
      user.value = data.user
      isAuthenticated.value = true
      return data
    }

    return data
  }

  function isRegisterError(data: RegisterResponse | RegisterError): data is RegisterError {
    return !('token' in data && 'user' in data)
  }

  function isRegisterResponse(data: RegisterResponse | RegisterError): data is RegisterResponse {
    return 'token' in data && 'user' in data
  }

  async function login(credentials: AuthUser): Promise<LoginResult | LoginError> {
    const url = `${baseUrl}/login`
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: withCsrfHeader({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(credentials),
    })
    const data = await response.json() as LoginResult | LoginError

    if (!response.ok || isTwoFactorChallenge(data))
      return data

    if (!isLoginResponse(data))
      return data

    storeLogin(data)
    return data
  }

  async function verifyTwoFactorLogin(challengeToken: string, code: string): Promise<LoginResponse | LoginError> {
    const response = await fetch(`${baseUrl}/verify-two-factor-login`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: withCsrfHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ challenge_token: challengeToken, code }),
    })
    const data = await response.json() as LoginResponse | LoginError
    if (!response.ok || !isLoginResponse(data))
      return data

    storeLogin(data)
    return data
  }

  async function logout() {
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

    token.value = ''
    user.value = null
    isAuthenticated.value = false
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
    checkAuthentication,
  }
}

export function describeAuthError(error: RegisterError | undefined, fallback: string): string {
  if (!error)
    return fallback
  if (error.message)
    return error.message
  if (error.error)
    return error.error
  return responseErrorMessage(error.errors) || fallback
}

function responseErrorMessage(error: ResponseError | undefined): string {
  if (!error)
    return ''
  if ('error' in error && typeof error.error === 'string')
    return error.error

  for (const messages of Object.values(error)) {
    if (!Array.isArray(messages))
      continue
    const first = messages[0]
    if (first?.message)
      return first.message
  }

  return ''
}

// Strict auth guard middleware
// Usage: call in setup() of page/component, or in router beforeEach
// Pass { guest: true } for guest-only pages
export function authGuard(options: { guest?: boolean } = {}): void {
  const guest = options.guest ?? false
  const { isAuthenticated } = useAuth()

  // Guard against SSR — window is only available in the browser
  if (typeof window === 'undefined') return

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
