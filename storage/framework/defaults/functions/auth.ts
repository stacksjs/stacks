import type { Ref } from 'vue'
import type { AuthUser, ErrorResponse, LoginError, LoginResponse, MeResponse, RegisterError, RegisterResponse, UserData } from '../types/dashboard'
import { useStorage } from '@vueuse/core'
import { ref } from 'vue'

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

const baseUrl = 'http://localhost:3008'

// Create singleton state
const isAuthenticated = ref(false)

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

      const { data } = await response.json() as MeResponse

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

  async function register(user: AuthUser): Promise<RegisterResponse | RegisterError> {
    const url = `${baseUrl}/register`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(user),
    })

    const data = await response.json() as RegisterResponse | RegisterError

    if (isRegisterError(data)) {
      return data
    }

    if (isRegisterResponse(data)) {
      token.value = data.data.token
      return data
    }

    return data
  }

  function isRegisterError(data: RegisterResponse | RegisterError): data is RegisterError {
    return 'errors' in data
  }

  function isRegisterResponse(data: RegisterResponse | RegisterError): data is RegisterResponse {
    return 'data' in data && 'token' in data.data
  }

  async function login(user: AuthUser): Promise<LoginResponse | LoginError> {
    try {
      const url = `${baseUrl}/login`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      })

      if (!response.ok) {
        const errorData = await response.json() as ErrorResponse
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json() as LoginResponse

      token.value = data.data.token

      return data
    }
    catch (error) {
      return error as LoginError
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await fetch(`${baseUrl}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        })
      }
    }
    catch (error) {
      console.error('Error during logout:', error)
    }
    finally {
      token.value = null
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

// Strict auth guard middleware
// Usage: call in setup() of page/component, or in router beforeEach
// Pass { guest: true } for guest-only pages
export function authGuard({ guest = false }: { guest?: boolean } = {}): void {
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
