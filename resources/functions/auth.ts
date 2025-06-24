import { computed } from 'vue'
import { useStorage } from '@vueuse/core'

const TOKEN_KEY = 'auth_token'

export function useAuth() {
  // Reactive token from localStorage
  const token = useStorage<string | null>(TOKEN_KEY, null)

  // Computed authentication state
  const isAuthenticated = computed(() => !!token.value)

  // Login: set token
  function login(newToken: string) {
    token.value = newToken
  }

  // Logout: clear token
  function logout() {
    token.value = null
  }

  // Get token (for API calls, etc.)
  function getToken() {
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
export function authGuard({ guest = false }: { guest?: boolean } = {}) {
  const { isAuthenticated } = useAuth()

  if (guest) {
    // Guest-only page: block if authenticated
    if (isAuthenticated.value) {
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      }
    }
    return
  }

  // Auth-only page: block if not authenticated
  if (!isAuthenticated.value) {
    if (typeof window !== 'undefined') {
      window.location.replace('/login')
    }
  }
}
