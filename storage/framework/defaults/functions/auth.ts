import { resolveApiBaseUrl } from './api-url'
import type { Ref } from '@stacksjs/stx'
import type { AuthUser, LoginError, LoginResponse, MeResponse, RegisterCredentials, RegisterError, RegisterResponse, ResponseError, UserData } from '../types/dashboard'
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

export interface AuthComposable {
  isAuthenticated: Ref<boolean>
  user: { value: UserData | null }
  login: (user: AuthUser) => Promise<LoginResponse | LoginError>
  register: (user: RegisterCredentials) => Promise<RegisterResponse | RegisterError>
  fetchAuthUser: () => Promise<UserData | null>
  checkAuthentication: () => Promise<boolean>
  logout: () => void
  getToken: () => string | null
  token: { value: string | null }
}

export function useAuth(): AuthComposable {
  async function fetchAuthUser(): Promise<UserData | null> {
    try {
      if (!token.value) {
        isAuthenticated.value = false
        user.value = null
        return null
      }

      const response = await fetch(`${baseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${token.value}`,
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

  async function login(credentials: AuthUser): Promise<LoginResponse | LoginError> {
    const url = `${baseUrl}/login`
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: withCsrfHeader({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(credentials),
    })
    const data = await response.json() as LoginResponse | LoginError

    if (!response.ok || !('token' in data && 'user' in data))
      return data

    token.value = data.token
    user.value = data.user
    isAuthenticated.value = true
    return data
  }

  async function logout() {
    try {
      if (token.value) {
        await fetch(`${baseUrl}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token.value}`,
            Accept: 'application/json',
          },
        })
      }
    }
    catch (error) {
      console.error('Error during logout:', error)
    }
    finally {
      token.value = ''
      user.value = null
      isAuthenticated.value = false
    }
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
