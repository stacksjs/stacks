import type { AuthComposable, AuthUser, ErrorResponse, LoginError, LoginResponse, MeResponse, RegisterError, RegisterResponse, UserData } from '../types/dashboard'
import { useStorage } from '@vueuse/core'
/// <reference lib="dom" />
import { ref } from 'vue'

const token = useStorage('token', '')

const baseUrl = 'http://localhost:3008'

// Create singleton state
const user = ref<UserData | null>(null)
const isAuthenticated = ref(false)

export function useAuth(): AuthComposable {
  async function fetchAuthUser(): Promise<UserData | null> {
    try {
      if (!token) {
        isAuthenticated.value = false
        user.value = null
        return null
      }

      const response = await fetch(`${baseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        token.value = null
        isAuthenticated.value = false
        user.value = null
        return null
      }

      const data = await response.json() as MeResponse
      user.value = data.user
      isAuthenticated.value = true

      return data.user
    }
    catch (error) {
      console.error('Error fetching user:', error)
      token.value = null
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
      await fetchAuthUser() // Fetch user data after successful login
      return data
    }
    catch (error) {
      return error as LoginError
    }
  }

  async function logout() {
    try {
      const token = localStorage.getItem('token')
      if (token) {
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
      localStorage.removeItem('token')
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
