import { computed, type ComputedRef, type Ref } from 'vue'
import { useStorage } from '@vueuse/core'

const TOKEN_KEY = 'auth_token'

interface AuthComposable {
  isAuthenticated: ComputedRef<boolean>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  getToken: () => string | null
  token: Ref<string | null>
}

export function useAuth(): AuthComposable {
  // Reactive token from localStorage
  const token = useStorage<string | null>(TOKEN_KEY, null)

  // Computed authentication state
  const isAuthenticated = computed(() => !!token.value)

  // Login: send credentials, set token if successful
  async function login(username: string, password: string): Promise<void> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        throw new Error('Login failed')
      }

      const data = await response.json()
      if (!data.token) {
        throw new Error('No token returned')
      }

      token.value = data.token
      window.location.replace('/')
    } catch (error) {
      // Handle error (show message, etc.)
      throw error
    }
  }

  // Logout: clear token
  function logout(): void {
    token.value = null
  }

  // Get token (for API calls, etc.)
  function getToken(): string | null {
    return token.value
  }

  return {
    isAuthenticated,
    login,
    logout,
    getToken,
    token, // expose for advanced use
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
